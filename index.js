const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require("cookie-parser");
require('dotenv').config();
const port = process.env.PORT || 5000;


// This is your test secret API key.
const stripe = require("stripe")(process.env.PK_KEY);

app.use(express.static("public"));

/**
 * ________________________________________
 *        MIDDDLE WARE
 * __________________________________________
 */
const corsOptions = {
   origin: ['http://192.168.0.102:5173', 'http://localhost:5173', 'http://localhost:3000', 'https://bistro-boss-server-hossain-ahamed.vercel.app','',process.env.clientURL],
  credentials: true,
};


app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', corsOptions.origin);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});


const verifyJWT = (req, res, next) => {
  // console.log(req.cookies)
  // console.log('header ',req.headers)
  const authorization = req.headers.authorization;
  // console.log('auth ',authorization)
  if (!authorization) {
    console.log("auth paini for", req.path)
    return res.status(401).send({ error: true, message: "Unauthorized Access" });
  }

  //bearer token
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log("auth invalid")
      return res.status(403).send({ error: true, message: "Unauthorized Access || Invalid Token" });
    }
    // console.log("error hoyn")
    req.decoded = decoded;
    next();

  })

}


app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

/**
 * _________________________________________________________________________________________________________________
 */

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@trial01.9ddajtx.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect(); 
    // Send a ping to confirm a successful connection
    const database = client.db("bistro-db");
    const menuCollection = client.db("bistro-db").collection("menuCollection");
    const reviewsCollection = client.db("bistro-db").collection("reviewsCollection");
    const cartCollection = client.db("bistro-db").collection("cartCollection");
    const usersCollection = client.db("bistro-db").collection("usersCollection");
    const paymentCollection = client.db("bistro-db").collection("payments");

    /** admin verify */

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const existedUser = await usersCollection.findOne({ email: email });
      if (existedUser?.role !== "Admin") {
        console.log(email, ' is not an admin ')
        return res.status(403).send({ msg: 'Forbidden by middle ware check' })
      }
      next();
    }

    // jwt 
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.cookie("_at", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        expires: new Date(Date.now() + 8 * 60 * 60 * 1000),
      });
      res.send({ token })

    })

    app.get('/menu', async (req, res) => {

      const result = await menuCollection.find().toArray();


      res.status(200).json(result);
    })

    //delete a menu
    app.delete('/menu/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const menuID = req.params.id;
      console.log(menuID)
      const result = await menuCollection.deleteOne({ _id: new ObjectId(menuID) });
      res.status(200).json(result);
    })


    // reviews 
    app.get('/reviews', async (req, res) => {
      const result = await reviewsCollection.find().sort({ _id: -1 }).toArray();
      res.status(200).json(result);
    })

    /**
     * __________________________________
     * CART MANAGEMENTS ---  Naming Convention -- cartCollection
     * __________________________________
     * app.get('cart/:id')  ==> to get the cart info of user
     * app.post(/carts) ==> to add in cart
    **/


    // fetch data  
    app.get('/carts', verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.send([]);

      }

      if (email !== req.decoded?.email) {
        return res.status(403).status({ message: "Forbidden " })
      }
      const result = await cartCollection.find({ email: email }).toArray();

      res.send(result)

    })


    app.post('/carts', async (req, res) => {
      const item = req.body;
      if (!item) {
        res.status(400).send({ message: 'no item added' });
        return;

      }
      try {
        const data = await cartCollection.insertOne(item);
        res.send(data);
      } catch {
        e => {
          res.status(500).send(false)
        }
      }
    })


    // delete a cart item 
    app.delete('/carts/:id', async (req, res) => {
      try {
        const id = req.params.id
        const result = await cartCollection.deleteOne({ _id: new ObjectId(id) });
        res.status(200).send(result)
      } catch {
        e => {
          res.status(500).send(false)
        }
      }

    })


    /** 
     * _________________________________________________________________________
     * _________________________________________________________________________
     * ___________________________USER PROFILE HANDLE __________________________ 
     * _________________________________________________________________________
     * _________________________________________________________________________
     * get '/users'                => get all the user
     * post /users                 => create a unique user in db
     * patch /users/admin/:_id     => make a user to admin
     **/


    // get all the users 
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const users = await usersCollection.find().sort({ _id: -1 }).toArray();
        res.status(200).send({ users: users });
      } catch {
        e => {
          res.status(500).send({ msg: "internal server errro" })
        }
      }
    })

    //create a  user to db 
    app.post('/users', async (req, res) => {
      const user = req.body;
      try {
        console.log(user)
        const existed = await usersCollection.findOne({ email: req.body?.email });
        if (existed) {
          return res.status(200).send({ msg: 'already saved' })
        }
        if (!req.body) {
          return res.status(400).send({ msg: 'No data given' })
        }
        const result = await usersCollection.insertOne(user);
        res.status(200).send(result);
      } catch {
        e => {
          res.status(500).send({ msg: "internal server errro" })
        }
      }
    })


    // make a user to Admin
    app.patch('/users/admin/:_id', async (req, res) => {
      const user_id = req.params._id;
      try {

        const existed = await usersCollection.findOne({ _id: new ObjectId(user_id) });
        if (!existed) {
          return res.status(404).send({ msg: 'not found ' })
        }
        const result = await usersCollection.updateOne({ _id: new ObjectId(user_id) }, { $set: { role: "Admin" } });
        res.status(200).send(result);
      } catch {
        e => {
          res.status(500).send({ msg: "internal server errro" })
        }
      }
    })



    // check a user to Admin
    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded?.email !== email) {
        return res.send({ admin: false })
      }
      try {

        const existedUser = await usersCollection.findOne({ email: email });
        if (!existedUser) {
          return res.send({ admin: false })
        }
        const result = { admin: existedUser?.role === "Admin" };

        res.status(200).send(result);
      } catch {
        e => {
          res.status(500).send({ msg: "internal server errro" })
        }
      }
    })


    /**
     * _________________________________
     * ______________ UPLOAD MENU_______
     */
    app.post('/add-items', verifyJWT, verifyAdmin, async (req, res) => {
      const menudata = req.body;
      try {


        if (!req.body) {
          return res.status(400).send({ msg: 'No data given' })
        }
        const result = await menuCollection.insertOne(menudata);
        res.status(200).send(result);
      } catch {
        e => {
          res.status(500).send({ msg: "internal server errro" })
        }
      }
    })

    /**
     * _______________________________________________________________________
     * _______________ ORDER MANAGMENT ______________________________________
     * "/payment-intenet"   payment gateway
     */


    // payment gateway 
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;

      const ammount = parseInt(price * 100);


      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: ammount,
        currency: "usd",

        // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //payment after order
    app.post("/payments", verifyJWT, async (req, res) => {
      const data = req.body;

      const {
        email,
        transaction_method_email,
        transaction_method_name,
        transaction_method_phone,
        transactionID,
        intent_methodID,
        methodID,
        price,
        orderLength,
        cartID,
        menuItems,
        itemsName,
        date,
        status } = data;

      const serverData = {
        email,
        transaction_method_email,
        transaction_method_name,
        transaction_method_phone,
        transactionID,
        intent_methodID,
        methodID,
        price,
        orderLength,
        menuItems,
        itemsName,
        date,
        status
      }

      serverData.menuItems = await menuItems.map(i => new ObjectId(i))
      const result = await paymentCollection.insertOne(serverData);

      const query = { _id: { $in: cartID.map(id => new ObjectId(id)) } };
      const deleteResult = await cartCollection.deleteMany(query)
      res.send({ result: result, deleteResult })
    });

    //______________________________________________ admin dashboard __________________________


    // get the stat 
    app.get('/admin-stat', async (req, res) => {
      const users = await usersCollection.estimatedDocumentCount();
      const products = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();


      // best way to get sum of a field is to use group 
      const total = await paymentCollection.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: '$price' }
          }
        }
      ]).toArray();


      const data = {
        users,
        products,
        orders,
        total: total[0]?.total
      }
      res.status(200).send(data)
    })
    /**
        * ---------------
        * BANGLA SYSTEM(second best solution)
        * ---------------
        * 1. load all payments
        * 2. for each payment, get the menuItems array
        * 3. for each item in the menuItems array get the menuItem from the menu collection
        * 4. put them in an array: allOrderedItems
        * 5. separate allOrderedItems by category using filter
        * 6. now get the quantity by using length: pizzas.length
        * 7. for each category use reduce to get the total amount spent on this category
        * 
       */
    app.get('/order-status', async (req, res) => {

      try {
        const pipeline = [

          {
            $lookup: {
              from: 'menuCollection',
              foreignField: '_id',
              localField: 'menuItems',
              as: 'data'
            }
          },
          {
            $unwind: '$data'
          },
          {
            $group: {
              _id: '$data.category',
              count: { $sum: 1 },
              total: { $sum: '$data.price' }
            }
          },
          {
            $project: {
              category: '$_id',
              count: 1,
              total: { $round: ['$total', 2] },
              _id: 0
            }
          }
        ];


        const results = await paymentCollection.aggregate(pipeline).toArray();
        console.log(results)
        res.json(results);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
      }
    })


    app.get('/my-orders/:mail', verifyJWT, async (req, res) => {
      const mail = req.params.mail;

      const orders = await paymentCollection.find({ email: mail }).toArray();
      res.send(orders)
    })

  

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send({ data: 'bistro boss'});
})
app.get('/alu-parata', (req, res) => {

  const data = {
    DB_USER: process.env.DB_USER,
    DB_PASS: process.env.DB_PASS,
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,

    PK_KEY: process.env.PK_KEY,

    clientURL: process.env.clientURL,
  }
  res.send({ data: 'alu parata', key: process.env.PK_KEY, ...data });
})

app.listen(port, () => {
  console.log('port choling ', port)
})
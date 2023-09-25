const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;



/**
 * ________________________________________
 *        MIDDDLE WARE
 * __________________________________________
 */
const corsOptions = {
  origin: ['*', 'http://192.168.0.102:5173', 'http://localhost:5173'],
  credentials: true,
};


app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', corsOptions.origin);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});



app.use(cors(corsOptions));
app.use(express.json());

/**
 * _________________________________________________________________________________________________________________
 */

const { MongoClient, ServerApiVersion } = require('mongodb');
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
    const menuCollection = database.collection("menuCollection");
    const reviewsCollection = database.collection("reviewsCollection");
    const cartCollection = database.collection("cartCollection");


    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray();
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
    app.get('/carts',async (req,res)=>{
      const email = req.query.email;
      if(!email){
        res.send([]);
        return;
      }
      const result =await cartCollection.find({ email : email}).toArray();
  
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

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('bistro boss');
})


app.listen(port, () => {
  console.log('port choling ', port)
})
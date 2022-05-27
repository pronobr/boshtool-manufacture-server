const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt  = require('jsonwebtoken')
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');
var ObjectId = require('mongodb').ObjectID;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.j6nzo.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'UnAuthorized access' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'Forbidden access' })
    }
    req.decoded = decoded;
    next();
  });
}
async function run(){
try{

     await client.connect();
     console.log('conntetede')
    //  const toolCollection =client.db('tools-manufacturer').collections('tools')
     const serviceCollection  =client.db('tools-manufacturer').collection('tools')
     const bookingCollection  =client.db('tools-manufacturer').collection('bookings')
     const reviewCollection  =client.db('tools-manufacturer').collection('review')
     const paymentCollection = client.db('tools-manufacturer').collection('payments');
     const userCollection = client.db('tools-manufacturer').collection('user');
     app.get('/tools', async(req,res) =>{
        const query = {};
        const cursor = serviceCollection.find(query);
        const tools = await cursor.toArray();
        res.send(tools);
     })
     app.put('/user/:email', async(req,res) =>{
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ result, token });
     })

     app.put('/user/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requester =req.decoded.email;
      const requesterAecount = await userCollection.findOne({email:requester})
      if(requesterAecount.role ==='admin'){
        const filter = { email: email };
        const updateDoc = {
          $set: { role: 'admin' },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
      else {
        return res.status(403).send({ message: 'forbidden access' });
      }
     
    })
    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;
      console.log(email)
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === 'admin';
      res.send({ admin: isAdmin })
    })
     app.get('/tool/:id',async(req,res) =>{
      const id =req.params.id
      
      const query={_id:ObjectId(id)}
      console.log(query)

      const product =await serviceCollection.findOne(query)
      res.send(product)
  })

  app.delete("/delete/:email",verifyJWT, async(req,res) =>{
    const email =req.params.email;
    const query ={email:email}
    const result = await bookingCollection.deleteOne(query)
    res.send(result)
})
  app.delete("/delete/:id",verifyJWT, async(req,res) =>{
    const id =req.params.id;
    const query ={_id:ObjectId(id)}
    const result = await serviceCollection.deleteOne(query)
    res.send(result)
})

  app.patch('/booking/:id', async(req, res) =>{
    const id  = req.params.id;
    console.log(id)
    const payment = req.body;
    const filter = {_id: ObjectId(id)};
    const updatedDoc = {
      $set: {
        paid: true,
        transactionId: payment.transactionId
      }
    }

    const result = await paymentCollection.insertOne(payment);
    const updatedBooking = await bookingCollection.updateOne(filter, updatedDoc);
    res.send(updatedBooking);
  })
  app.post('/create-payment-intent', async(req, res) =>{
    const service = req.body.price*100
    // const price =  service.price
    // const amount =price*100;
    console.log(service)
    const paymentIntent = await stripe.paymentIntents.create({
      amount : service,
      currency: 'usd',
      payment_method_types:['card']
    });
    res.send({clientSecret: paymentIntent.client_secret})
      
    
  });

  app.get('/booking/:id', async(req, res) =>{
    const id = req.params.id;
    const query = {_id: ObjectId(id)};
    const booking = await bookingCollection.findOne(query);
    res.send(booking);
  })
  app.get('/booking', verifyJWT, async (req, res) =>{
    const email =req.query.email;
    const decodedEmail = req.decoded.email;
    console.log(email,decodedEmail)
    if (email === decodedEmail) {
      const query = { email: email };
      const bookings = await bookingCollection.find(query).toArray();
      return res.send(bookings);
    }
    else {
      return res.status(403).send({ message: 'forbidden access' });
    }

  })

  app.get('/user',verifyJWT,async(req,res) =>{
    const users =await userCollection.find().toArray()
    res.send(users)
  })
  app.post('/booking', async (req, res) => {
    const booking = req.body;
    const query = {booking}
    const exists = await bookingCollection.findOne(query);
    if (exists) {
      return res.send({ success: false, booking: exists })
    }
    const result = await bookingCollection.insertOne(booking);
    return res.send({ success: true, result });
  })

  app.post('/tools', verifyJWT, async (req, res) => {
    const product = req.body;
    console.log(product)
    const result = await serviceCollection.insertOne(product);
    res.send(result);
  });
   app.get('/review',async(req,res) =>{
    const users =await reviewCollection.find().toArray()
    res.send(users)
  })
  app.post('/review', async (req, res) => {
    const review = req.body;
    const query = {review}
    console.log(review)
    const exists = await reviewCollection.findOne(query);
    if (exists) {
      return res.send({ success: false, booking: exists })
    }
    const result = await reviewCollection.insertOne(review);
    return res.send({ success: true, result });
  })

}
finally{

}
}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Hello From Doctor Uncle!')
  })
  
  app.listen(port, () => {
    console.log(`Doctors App listening on port ${port}`)
  })
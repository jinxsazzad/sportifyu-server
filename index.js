const express = require("express");
const cors = require("cors");
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());


//verifyJWT
const verifyJWT = (req,res,next)=>{
  const authorization = req.headers.authorization
  if(!authorization){
    return res.status(401).send({error:true,message:'unauthorized access'})
  }
  //bearer token
  const token = authorization.split(' ')[1]
//match token
jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
  if(err){
    return res.status(401).send({error:true,message:'unauthorized access'})
  }
  req.decoded =decoded;
  next();
})

}

//MongoDB Code
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wdftcpy.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db('sportSpark');
    const usersCollection = db.collection('users');

    //all api code would be here
    app.post ('/jwt',(req,res)=>{
      const user= req.body;
      const token= jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{
        expiresIn:'10h'
      })
      res.send({token})
    })


    //verifyAdmin
    const verifyAdmin = async (req,res,next)=>{
      const email = req.decoded.email;
      const query = {email:email}
      const user = await usersCollection.findOne(query);
      if( user?.role !== 'admin'){
        return res.status(403).send({error:true, message:'forbidden user'})
      }
      next();
    }
    // handle Users

   //1.save user mail and role in db
   app.put('/users:email', async (req,res)=>{
    const email = req.params.email
    const user = req.body;
    console.log(user)
    const query = {email:email}
    const option = {upsert:true}
    const updateDoc = {
      $set:user,
    }
    const existingUser = await usersCollection.findOne(query);

    if(existingUser){
      return res.send({message:'user already exists'})
    }

    const result = await usersCollection.updateOne(query,updateDoc,option);
    res.send(result)
   })
  // app.put('/users/:email', async (req, res) => {
  //   const email = req.params.email
  //   const user = req.body
  //   const query = { email: email }
  //   const options = { upsert: true }
  //   const updateDoc = {
  //     $set: user,
  //   }
  //   const result = await usersCollection.updateOne(query, updateDoc, options)
  //   res.send(result)
  // })

   //2. get all users
   app.get('/users',async (req,res)=>{
    const result = await usersCollection.find().toArray();
    res.send(result)

   })








    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB Connected!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send(`
  <h1 style="text-align:center; margin-top:5rem">
      It's a Backed Server of 
      <b style="color:red;padding:2rem">Assignment Twelve</b> Site !
      <br/><br/>
      Site Port : <b style="color:red"> ${port} </b>
  </h1>`);
});

app.listen(port, () => {
  console.log(`Assignment Twelve is On Port:${port}`);
});

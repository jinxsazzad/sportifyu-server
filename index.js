const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

//verifyJWT
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  //bearer token
  const token = authorization.split(" ")[1];
  //match token
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

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

    //collections
    const db = client.db("sportSpark");
    const usersCollection = db.collection("users");
    const classesCollection = db.collection("classes");
    const studentsClassesCollection = db.collection("students-classes");

    //all api code would be here
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "10h",
      });
      res.send({ token });
    });

    //verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({ error: true, message: "forbidden user" });
      }
      next();
    };

    // handle Users
    //1.save user mail and role in db
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
    
      try {
        const existingUser = await usersCollection.findOne({ email: email });
    
        if (!existingUser) {
          const newUser = { ...user, role: "student" }; // Modify the role for new users
          const result = await usersCollection.insertOne(newUser);
          res.send(result);
        } else {
          const updateDoc = {
            $set: user,
          };
    
          const result = await usersCollection.updateOne(
            { email: email },
            updateDoc
          );
          res.send(result);
        }
      } catch (error) {
        res.status(500).send({
          error: "An error occurred while creating or updating the user.",
        });
      }
    });
    

    //2. get user role
    app.get('/users/:email', async (req, res) => {
      const email = req.params.email
      const query = { email: email }
      const result = await usersCollection.findOne(query)
      res.send(result)
    })
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    

    //class data
    //get all class
    app.get("/classes", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    app.get("/classes/approved", async (req, res) => {
      try {
        const approvedClasses = await classesCollection.find({ status: "approved" }).toArray();
        res.send(approvedClasses);
      } catch (error) {
        res.status(500).send({ error: "An error occurred while retrieving the approved classes." });
      }
    });

    app.put("/classes/:classId/status", async (req, res) => {
      const classId = req.params.classId;
      const newStatus = req.body.status;
    
      try {
        const updatedClass = await classesCollection.findOneAndUpdate(
          { _id: new ObjectId(classId) },
          { $set: { status: newStatus } },
          { returnOriginal: false }
        );
    
        if (!updatedClass) {
          return res.status(404).send({ error: "Class not found." });
        }
    
        res.send(updatedClass);
      } catch (error) {
        console.error("Error updating class status:", error);
        res.status(500).send({ error: "An error occurred while updating the class status." });
      }
    });

    app.put("/classes/:classId/feedback", async (req, res) => {
      const classId = req.params.classId;
      const feedbackId = req.body.feedbackId;
      const feedbackText = req.body.feedbackText;
    
      try {
        const updatedClass = await classesCollection.findOneAndUpdate(
          { _id: new ObjectId(classId), "adminFeedback._id": ObjectId(feedbackId) },
          { $set: { "adminFeedback.$.text": feedbackText } },
          { returnOriginal: false }
        );
    
        if (!updatedClass.value) {
          return res.status(404).send({ error: "Class or feedback not found." });
        }
    
        res.send(updatedClass.value);
      } catch (error) {
        res.status(500).send({ error: "An error occurred while updating the feedback." });
      }
    });
    
    
    
    

    app.get("/student-classes/:email", async (req, res) => {
      const email = req.params.email;
      const query = { studentEmail: email, selected: true };
      const result = await studentsClassesCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/popular-classes", async (req, res) => {
      const result = await classesCollection
        .find({ enrolledStudent: { $exists: true } })
        .sort({ enrolledStudent: -1 })
        .limit(6)
        .toArray();

      res.send(result);
    });

    app.get("/classes/id/:id", async (req, res) => {
      try {
        const classId = req.params.id;
        const result = await classesCollection.findOne({
          _id: new ObjectId(classId),
        });

        if (result) {
          res.send(result);
        } else {
          res.status(404).send("Class not found");
        }
      } catch (error) {
        console.error("Error fetching class:", error);
        res.status(500).send("Internal server error");
      }
    });

    //get class by email
    app.get("/classes/email/:email", async (req, res) => {
      const email = req.params.email;
      const myClass = await classesCollection
        .find({ instructorEmail: email })
        .toArray();
      res.send(myClass);
    });

    app.post("/classes", async (req, res) => {
      const body = req.body;
      const result = await classesCollection.insertOne(body);
      res.send(result);
    });

    app.post("/students-classes", async (req, res) => {
      const body = req.body;
      const result = await studentsClassesCollection.insertOne(body);
      res.send(result);
    });

    app.patch("/classes/update-instructor/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          className: body.className,
          classPicture: body.classPicture,
          classPrice: body.classPrice,
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.patch("/classes/update-student/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          selectedStudent: body.selectedStudent,
          availableSeats: body.availableSeats,
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/classes/id/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classesCollection.deleteOne(query);
      res.send(result);
    });

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

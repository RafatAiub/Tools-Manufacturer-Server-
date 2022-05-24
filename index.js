const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0-shard-00-00.ntump.mongodb.net:27017,cluster0-shard-00-01.ntump.mongodb.net:27017,cluster0-shard-00-02.ntump.mongodb.net:27017/?ssl=true&replicaSet=atlas-1jtay5-shard-0&authSource=admin&retryWrites=true&w=majority`;
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

async function run() {
    try {
        await client.connect();
        const toolCollection = client.db('tool_plaza').collection('tools');

        app.get('/tools', async (req, res) => {
            const query = {};
            const cursor = toolCollection.find(query).project();
            const tools = await cursor.toArray();
            res.send(tools);
        });


    }
    finally {

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello From manufacturer.com!')
})

app.listen(port, () => {
    console.log(`Manufacture App listening on port ${port}`)
})
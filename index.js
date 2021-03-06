const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const stripe = require('stripe')('sk_test_51L6SZ8GTsQfVYPnKlSDjCjuAiQ6TKkl31reNy9eAqFG9XX3jfnPun1q37TgiuHbD1QtjcCQLccbC7GPI9TaX91MH00ThLu61z7');
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
        const toolOrder = client.db('tool_plaza').collection('orders');
        const userCollection = client.db('tool_plaza').collection('users');
        const paymentCollection = client.db('tool_plaza').collection('payment');
        const userReviewCollection = client.db('tool_plaza').collection('userReviewCollection');

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }
        }

        app.get('/tools', async (req, res) => {
            const query = {};
            const cursor = toolCollection.find(query).project();
            const tools = await cursor.toArray();
            res.send(tools);
        });

        app.post('/tools', async (req, res) => {
            const tool = req.body;
            const result = await toolCollection.insertOne(tool);
            res.send(result);
        });

        app.get('/reviews', async (req, res) => {
            const query = {};
            const cursor = userReviewCollection.find(query).project();
            const reviews = await cursor.toArray();
            res.send(reviews);
        });
        app.post('/reviews', async (req, res) => {
            const review = req.body;
            const cursor = await userReviewCollection.insertOne(review);
            res.send(cursor);
        });

        app.get('/orders', async (req, res) => {
            const query = {};
            const cursor = toolOrder.find(query).project();
            const orders = await cursor.toArray();
            res.send(orders);
        });
        app.get('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await toolOrder.findOne(query);
            res.send(order);
        });
        app.patch('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }

            const result = await paymentCollection.insertOne(payment);
            const updatedOrder = await toolOrder.updateOne(filter, updatedDoc);
            res.send(updatedOrder);
        });
        app.get('/orders/:email', async (req, res) => {
            const email = req.params.email;
            const order = await toolOrder.find({ CustomerEmail: email }).project().toArray();
            res.send(order);
        });
        // app.get('orders/:email/:Product', async (req, res) => {
        //     const Product = req.params.Product;
        //     const email = req.params.email;
        //     const filter = { Product: Product, CustomerEmail: email };
        //     const result = await toolOrder.findOne(filter).project().toArray();
        //     res.send(result);
        // });

        // app.delete('orders/:email/:Product', async (req, res) => {
        //     const Product = req.params.Product;
        //     const email = req.params.email;
        //     const filter = { Product: Product, CustomerEmail: email };
        //     const result = await toolOrder.deleteOne(filter);
        //     res.send(result);
        // });

        app.post('/create-payment-intent', async (req, res) => {
            const order = req.body;
            const price = order.TotalPrice;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']

            });
            res.send({ clientSecret: paymentIntent.client_secret })
        })
        app.post('/orders', async (req, res) => {
            const order = req.body;
            const result = await toolOrder.insertOne(order);
            res.send(result);
        });

        app.get('/tools/:_id', async (req, res) => {
            const id = req.params._id;
            const query = { _id: ObjectId(id) };
            const cursor = await toolCollection.findOne(query);

            res.send(cursor);
        });

        app.get('/user', async (req, res) => {
            const query = {};
            const cursor = userCollection.find(query).project();
            const users = await cursor.toArray();
            res.send(users);
        });

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

        app.put('/user/admin/:email', verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }

        })

        app.put('/user/:email', async (req, res) => {
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
        });


    }
    finally {

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello From manufacturer.com!')
})

app.listen(port, (err) => {
    console.log(`Manufacture App listening on port ${port}`)
})
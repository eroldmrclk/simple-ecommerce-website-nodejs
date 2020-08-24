const express = require('express');
const session = require("express-session");
const app = express();
const exphbs = require('express-handlebars');
const bodyParser = require('body-parser');
var mongodb = require('mongodb');
var url = "mongodb://localhost:27017/";

var sess = {};
var sessCus = {};
var mongoClient = mongodb.MongoClient;
app.engine('handlebars', exphbs({ defaultLayout: 'main' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'handlebars');
app.use(express.static(__dirname + '/views'));

app.get("/admin", function (req, res) {
    res.render('index')
});
app.get("/homeAdmin", function (req, res) {
    if (sess.username && sess.password)
        res.render('homeAdmin');
    else {
        res.redirect('/admin');
    }
});

app.post("/Controller_adminLogin", function (req, res) {
    var username = req.body.username;
    var password = req.body.password;
    console.log(username + " " + password);
    mongoClient.connect(url, function (err, db) {
        if (err) throw err;
        else {
            var dbo = db.db("webprog");
            console.log("bağlandı mongodb");
            dbo.collection('admin', function (err, collection) {
                if (err) {
                    throw err;
                }
                else {
                    collection.findOne({ name: username, password: password }, function (err, result) {
                        if (result) {
                            sess.username = req.body.username;
                            sess.password = req.body.password;
                            res.redirect('/homeAdmin');
                        }
                        else {
                            res.redirect('/admin')
                        }
                    });
                    db.close();
                }
            })
        }
    });
});

app.get("/addProduct", (req, res) => {
    if (sess.username && sess.password)
        res.render('addProduct');
    else {
        res.redirect('/admin');
    }
});

app.post("/Controller_addProduct", (req, res) => {
    var pName = req.body.name;
    var pPrice = parseFloat(req.body.price);
    var pQuantity = parseInt(req.body.quantity);
    var pDescription = req.body.description;
    var pUrl = req.body.url;

    mongoClient.connect(url, function (err, db) {
        if (err) throw err;
        else {
            var dbo = db.db("webprog");

            const x = async function myFunc() {
                var id = await dbo.collection("products").estimatedDocumentCount();
                console.log(id);
                var obj = {
                    id: id + 1,
                    name: pName,
                    price: pPrice,
                    quantity: pQuantity,
                    description: pDescription,
                    url: pUrl
                }

                dbo.collection("products").insertOne(obj, (err, res) => {
                    if (err) throw err;
                    db.close();
                });
            }
            x();
            res.redirect('/addProduct');
        }
    });
});


app.get('/logout', function (req, res) {
    sess.username = null;
    sess.password = null;
    res.redirect('/admin');
});

app.get('/login', (req, res) => {
    res.render('customerLogin');
});

app.post('/login', (req, res) => {

    var username = req.body.customerName;
    var password = req.body.customerPassword;
    mongoClient.connect(url, function (err, db) {
        if (err) throw err;
        else {
            var dbo = db.db("webprog");
            console.log("bağlandı mongodb");
            dbo.collection('users', function (err, collection) {
                if (err) {
                    throw err;
                }
                else {
                    collection.findOne({ name: username, password: password }, function (err, result) {
                        if (result) {
                            sessCus.username = username;
                            sessCus.password = password;
                            res.redirect('/home');
                        }
                        else {
                            res.redirect('/login')
                        }
                    });
                    db.close();
                }
            })
        }
    });
});

app.get('/customerRegister', (req, res) => {
    res.render('customerRegister');
});

app.post('/customerRegister', (req, res) => {
    var customerUsername = req.body.customerName;
    var customerPassword = req.body.customerPassword;
    if (customerUsername != "" && customerPassword != "") {
        mongoClient.connect(url, function (err, db) {
            if (err) throw err;
            else {
                var dbo = db.db("webprog");

                const x = async function myFunc() {
                    var obj = {
                        name: customerUsername,
                        password: customerPassword,
                        shoppingCart: []
                    }

                    dbo.collection("users").insertOne(obj, (err, res) => {
                        if (err) throw err;
                        db.close();
                    });
                }
                x();
                res.redirect('/login');
            }
        });
    }
});

var shoppingCart = new Map();

app.get("/home", (req, res) => {

    mongoClient.connect(url, function (err, db) {
        if (err) throw err;
        var dbo = db.db("webprog");
        dbo.collection("products").find({}).toArray((err, result) => {
            if (err) throw err;
            res.render("home", { result: result });
        })
    });
});
app.get("/showProduct/:id/:quantity", (req, res) => {
    var idProdcut = parseInt(req.params.id)
    var quantityProduct = parseInt(req.params.quantity)
    mongoClient.connect(url, (err, db) => {
        if (err) throw err;
        var collection = db.db("webprog").collection("products");
        const x = async () => {
            var product = await collection.findOne({ id: idProdcut }, (err, document) => { res.render("showProduct", { product: document }) })
        }
        x();

    })
})
app.post("/buyProduct/:id/:quantity", (req, res) => {
    var idProdcut = parseInt(req.params.id)
    var quantityProduct = parseInt(req.params.quantity)


    mongoClient.connect(url, (err, db) => {
        var dbo = db.db("webprog");
        if (err) throw err;

        var findQuery = { id: idProdcut };
        var newValues = { $set: { quantity: quantityProduct - 1 } };
        dbo.collection("products").updateOne(findQuery, newValues, (err, res) => {
            if (err) throw err;
            else {
                console.log("1 Document Updated")


                if (sessCus.username && sessCus.password) {
                    var findQuery1 = { name: sessCus.username };
                    var newValues1 = { $push: { shoppingCart: idProdcut } }

                    dbo.collection("users").updateOne(findQuery1, newValues1, (err, res) => {
                        if (err) throw err;
                        console.log('sepete eklendi')
                    });

                }


            }
        })
    })
    res.redirect('/shoppingCart');
})

app.get("/shoppingCart", (req, res) => {
    var control = 0;
    var product = [];
    var shoppingCart = [];
    var result = [];
    if(sessCus.username && sessCus.password){
        mongoClient.connect(url, (err, db) => {
        var dbo = db.db("webprog");
        if (err) throw err;

        var user = dbo.collection("users").findOne({ name: sessCus.username, password: sessCus.password }, function (err, doc) {
            if (err) throw err;
            shoppingCart = doc.shoppingCart;
            const x = async () => {
                if(shoppingCart.length > 0){
                    shoppingCart.forEach(element => {
                    console.log(shoppingCart.length);
                    
                    dbo.collection("products").findOne({ id: element }, (err, resultz) => {
                        result.push(resultz)
                        control++;
                        console.log(shoppingCart.length+"  "+control);
                        if(control == shoppingCart.length){
                            console.log(result);
                            res.render('shoppingCart',{ result: result });
                        }
                    })
                });
                }
                else{
                    res.render('shoppingCart');
                }
                
            }
            x();
        });

    });
    }
    else{
        res.redirect('/login');
    }
    

});

app.get('/Controller_Payment',(req,res) => {
    var shoppingCart = [];
    var ress = res;
    if(sessCus.username && sessCus.password){
        mongoClient.connect(url, (err, db) => {
        var dbo = db.db("webprog");
        if (err) throw err;
        var findQuery = { name: sessCus.username };
        var newValues = { $set: { shoppingCart: shoppingCart } };
        dbo.collection("users").updateOne(findQuery, newValues, (err, res) => {
            if (err) throw err;
            else {
                console.log("Ödeme gerceklesti.")
                ress.render('payment',{username: sessCus.username});
            }
        })
    })
    }
    else{
        res.redirect('/login');
    }
});


app.get("/Controller_shoppingCart/:id", async(req, res) => {
    var prodcutId = parseInt(req.params.id);

    if (sessCus.username && sessCus.password) {
        await mongoClient.connect(url, async(err, db) => {
            var dbo = db.db("webprog");
            if (err) throw err;
            var findQuery1 = { name: sessCus.username };
            var newValues1 = { $pull: { shoppingCart: prodcutId } }

            await dbo.collection("users").updateOne(findQuery1, newValues1, (err, res) => {
                if (err) throw err;
                console.log('sepetten çıkartıldı')
            });
        });
    }
    res.redirect("/home")
})

app.listen(8080, () => {
    console.log('listening:8080');
});
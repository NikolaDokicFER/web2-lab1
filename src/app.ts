import express from 'express';
import fs from 'fs';
import path from 'path'
import https from 'https';
import { auth, requiresAuth, claimEquals} from 'express-openid-connect'; 
import dotenv from 'dotenv';
import bodyParser from 'body-parser'

dotenv.config()
const app = express();

app.set("views", path.join(__dirname, "views"));
app.use("/styles",express.static(__dirname + "/styles"));
app.set('view engine', 'ejs');

let results = require('./jsons/rounds.json');
let table = require('./jsons/table.json');
let comments = require('./jsons/comments.json');

const externalUrl = process.env.RENDER_EXTERNAL_URL;
const port = externalUrl && process.env.PORT ? parseInt(process.env.PORT) : 4080

const config = {
  authRequired: false,
  auth0Logout: true,
  baseURL: externalUrl ||  `https://localhost:${port}`,
  clientID: process.env.CLIENT_ID,
  issuerBaseURL: process.env.ISSUER_BASE_URL,
  secret: process.env.SECRET
};

var urlencodedParser = bodyParser.urlencoded({extended: false})

app.use(auth(config));
  
app.get('/',(req, res) => {
  if(req.oidc.isAuthenticated()){
    res.redirect('/home')
  }else{
    res.redirect('/public')
  }
});

app.get('/public', (req, res) => {
  res.render('public',  {
    results: results,
    table: table,
    comments: comments
  });
});

app.get('/home',(req, res) => {
  if(req.oidc.isAuthenticated()){
    res.render('home', {
      user: req.oidc.idTokenClaims,
      results: results,
      table: table,
      comments: comments
  });}
});

app.get('/admin', claimEquals('isAdmin', true), (req, res) => {
  if(req.oidc.isAuthenticated()){
    res.render('admin',  {
      user: req.oidc.idTokenClaims,
      results: results,
      table: table,
      comments: comments
  });}
});

app.post('/home', urlencodedParser ,(req, res) =>{
  let email = req.oidc.idTokenClaims?.email;
  let id = comments.comment[comments.comment.length - 1].id + 1
  comments.comment.push({"user":email, "text": req.body.commentText, "date":new Date().toJSON().slice(0,10).replace(/-/g,'/'), "round": req.body.round, "id": id});
  res.redirect('/home')
});

app.get('/home/:id', function (req, res, next) {
  if(req.oidc.isAuthenticated()){
    comments.comment.splice(req.params.id,1);
    res.redirect('/home')
  }
});

app.get('/admin/:id', claimEquals('isAdmin', true), function (req, res, next) {
  if(req.oidc.isAuthenticated()){
    comments.comment.splice(req.params.id,1);
    res.redirect('/admin')
  }
});

app.get('/admin/:round/:match/:result', claimEquals('isAdmin', true),function (req, res, next) {
  if(req.oidc.isAuthenticated()){
    results.round[req.params.round].results[req.params.match].score = req.params.result
    res.redirect('/admin')
  }
});

app.get('/admin/:spot/:name/:gd/:points', claimEquals('isAdmin', true),function (req, res, next) {
  if(req.oidc.isAuthenticated()){
    table.team[req.params.spot].name = req.params.name
    table.team[req.params.spot].gd = req.params.gd
    table.team[req.params.spot].points = req.params.points
    res.redirect('/admin')
  }
});

if (externalUrl) {
  const hostname = '127.0.0.1';
  app.listen(port, hostname, () => {
  console.log(`Server locally running at http://${hostname}:${port}/ and from
  outside on ${externalUrl}`);
  });
}else{
  https.createServer({
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.cert')
    }, app)
    .listen(port, function () {
      console.log(`Server running at https://localhost:${port}/`);
      });
}
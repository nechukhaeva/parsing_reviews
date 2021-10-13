const axios = require("axios");

module.exports = axios.create({
  baseURL: "http://localhost:5500/", //https://api.darall.pro/v1/
  headers: { 
    "Content-type": "application/json",
    'Access-Control-Allow-Origin': '*',
  }
})
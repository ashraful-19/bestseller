const mongoose = require("mongoose");
require('dotenv').config();
const db = process.env.dbURL;

mongoose.set('strictQuery', false); //ekta warning ashe tai eta die rakhsi

  mongoose.connect(db)
  .then(() => console.log('Connected to Database'))
  .catch(error => console.error('Error connecting to MongoDB Atlas:', error));

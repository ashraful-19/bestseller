// product.js (Mongoose Schema)
const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
color: String,
colorCode: String,
filename: String,
});


const productSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true
    },
    slug: {
      type: String,
      required: true
    },
    productCode: String,
    shortDescription: String,
    description: String,
    regularPrice: Number,
    discountPrice: Number,
    stockQuantity: Number,
    insideDhaka: Number,
    outsideDhaka: Number,
    category: String,
    brand: String,
    color: [String],
    tags: [String],
    images: [imageSchema],
    previewImage: String,
    reviews: [{
      userName: String,
      email: String,
      comment: String
    }],
    productCode: String,
    video: String,
    isBestSeller: Boolean,
    isNewArrival: Boolean,
    isFeatured: Boolean,
    isFreeDelivery: Boolean,
    isVisible: Boolean,
    isInStock: Boolean,
    handlingTime: String,
    averageRating: Number
  });



 // Define schema for order
const orderSchema = new mongoose.Schema({
  orderNumber: { type: Number },
  orderDate: { type: Date, default: Date.now },
  products: [{
      id: { type: String },
      name: { type: String },
      metaData: { type: String },
      productImage: { type: String },
      color: { type: String, default: "No Color" },
      quantity: { type: Number, default: 0 },
      sellingPrice: { type: Number },
      totalSellingPrice : { type: Number },
      
  }],
  subTotal: { type: Number },
  shippingCost: { type: Number },
  totalAmount: { type: Number },
  paymentMethod: { type: String },
  billingAddress: {
      name: { type: String },
      mobileNumber: { type: String },
      address: { type: String },
  },
  deliveryStatus: { type: String },
  paymentStatus: { type: String },
  userNotes: { type: String },
  adminNotes: { type: String },
});

// Create model

const Order = mongoose.model('Order', orderSchema);
const Product = mongoose.model('Product', productSchema);

module.exports = {Product, Order};
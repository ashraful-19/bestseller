// Import required modules
const express = require('express');
const path = require('path');
const multer = require('multer');
const slugify = require('slugify');
const { google } = require("googleapis");
const uuid = require('uuid'); 
require('dotenv').config();
const db = require('./config/db');  
const {Product, Order} = require('./model/admin');
const session = require("express-session");
const MongoStore = require("connect-mongo");

// Create an Express application
const app = express();
const port = 3000;
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
      mongoUrl: process.env.dbURL,
      collectionName: "sessions",
    }),
    // cookie: { secure: true },
  })
);


const spreadsheetId = '1XK_4b2lSt20cs9iyLvFVoJY98RbaIbDgciG7XQHagKo';
// Google Sheets API setup
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS), 
  scopes: 'https://www.googleapis.com/auth/spreadsheets',
});

// Helper function to get Google Sheets client
async function getGoogleSheetsClient() {
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

// Helper function to get spreadsheet metadata (optional)
async function getSpreadsheetMetaData() {
  const googleSheets = await getGoogleSheetsClient();
  const metaData = await googleSheets.spreadsheets.get({
    spreadsheetId,
  });
  return metaData;
}


// Set the view engine to EJS
app.set('view engine', 'ejs');

// Set the path to the views directory
app.set('views', path.join(__dirname, 'views'));



app.use((req,res,next) => {
// console.log(req.session)

next();
});



app.get('/', async (req, res) => {
  try {
    const products = await Product.find();
    const cart = req.session.cart;
    res.render('home/index', { products,cart });
  } catch (error) {
    console.error('Error retrieving products:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/product/:category/:name', async (req, res) => {
  try {
  const product_id = req.params.name;
  console.log(product_id);
  const product_category = req.params.category;
  console.log(product_category);
  const product = await Product.findOne({slug: product_id});
  const products = await Product.find({category: product_category});
  
  const cart = req.session.cart;
    res.render('home/single-product', { products,product, cart });
  } catch (error) {
    console.error('Error retrieving products:', error);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/product/:category', async (req, res) => {
  try {
  const product_cat = req.params.category;
  console.log(product_cat)
    const products = await Product.findOne({category: product_cat});
    console.log(products)
    const cart = req.session.cart;
    res.render('home/category', { products, cart });
  } catch (error) {
    console.error('Error retrieving products:', error);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/get-single-product', async (req, res) => {
  try {
  const product_id = req.body.id;
  console.log(product_id)
    const product = await Product.findOne({id: product_id});
    res.json({ message: 'Product added to cart successfully', product });
  } catch (error) {
    console.error('Error retrieving products:', error);
    res.status(500).send('Internal Server Error');
  }
});


app.post('/add-to-cart', async (req, res) => {
    try {
        const { id, productId, productCode, productName, productImage, metaData, quantity, sellingPrice, insideDhaka, outsideDhaka } = req.body;

        // Access the session object
        const cart = req.session.cart || [];

        // Find the index of the cart item corresponding to the product being added
        const index = cart.findIndex(item => item.id === id);

        if (index !== -1) {
            // Case 1: Product with the same id exists in the cart
            const existingItem = cart[index];
            existingItem.quantity = quantity; // Update the quantity
        } else {
            // Case 2: Product id does not exist in the cart
            const existingProductIndex = cart.findIndex(item => item.productId === productId && item.metaData === metaData);

            if (existingProductIndex !== -1) {
                // Product id exists in the cart, check metaData
                const existingItem = cart[existingProductIndex];
                existingItem.quantity = quantity;
            } else {
                // MetaData does not match, add a new item with new id and same productId
                const newItem = {
                    id: uuid.v4(), // Generate a new unique ID for the cart item
                    productId,
                    productCode,
                    productName,
                    productImage,
                    quantity,
                    sellingPrice,
                    metaData,
                    insideDhaka,
                    outsideDhaka,
                };
                cart.push(newItem);
            }
        }

        req.session.cart = cart;
        if (req.query.buy == 'true') {
         res.redirect('/checkout');
        }else{
          res.json({ message: 'Product added to cart successfully', cart });
        }
    } catch (error) {
        console.error('Error adding product to cart:', error);
        res.status(500).json({ error: 'An error occurred while adding the product to the cart' });
    }
});




app.post('/add-to-cart-remove', async (req, res) => {
  try {
      const { id } = req.body;

      // Access the session object
      const cart = req.session.cart || [];

      // Find the index of the cart item corresponding to the product being removed
      const index = cart.findIndex(item => item.id === id);

      if (index !== -1) {
          // Remove the product from the cart array
          cart.splice(index, 1);

          // Save the updated cart back to the session
          req.session.cart = cart;

          res.json({ message: 'Product removed from cart successfully', cart });
      } else {
          res.status(404).json({ error: 'Product not found in cart' });
      }
  } catch (error) {
      console.error('Error removing product from cart:', error);
      res.status(500).json({ error: 'An error occurred while removing the product from the cart' });
  }
});


app.get('/checkout', async (req, res) => {
  try {

    const cart = req.session.cart;
    res.render('home/shopping-cart', { cart });

  } catch (error) {
      console.error('Error retrieving product:', error);
      res.status(500).send('Internal Server Error');
  }
});

app.post('/order-confirmation', async (req, res) => {
  try {
    const orderData = req.body; // This will contain the parsed JSON data
console.log(orderData)
    if (!orderData.orderDate) {
      orderData.orderDate = new Date().toISOString().split('T')[0]; // Set current date if not provided
    }

    if (orderData.orderNumber) {
      // Update existing order if orderNumber already exists
      const existingOrder = await Order.findOneAndUpdate(
        { orderNumber: orderData.orderNumber },
        { $set: orderData },
        { new: true }
      );

      if (!existingOrder) {
        return res.status(404).json({ error: 'Order not found' });
      }

      console.log('Order updated successfully:', existingOrder);
      return res.status(200).json({ message: 'Order updated successfully', order: existingOrder });
    } else {
      // Find the highest orderNumber
      const highestOrder = await Order.findOne().sort({ orderNumber: -1 }).exec();
      let nextOrderNumber = 1; // Default orderNumber if no orders exist yet

      if (highestOrder) {
        nextOrderNumber = highestOrder.orderNumber + 1;
      }

      // Add orderNumber to orderData and create a new order instance
      const newOrder = new Order({
        ...orderData,
        orderNumber: nextOrderNumber,
      });

      // Save the new order to the database
      const savedOrder = await newOrder.save();

      // Prepare data for Google Sheets
      const googleSheets = await getGoogleSheetsClient();

      // Prepare values for appending
      let values = [];
// Push header row for Google Sheet (if needed, can be skipped if headers are already present)
values.push([
  'Order Date', 'Order Number', 'Payment Method', 'Total Amount',
  'Billing Name', 'Mobile Number', 'Address', 'User Notes',
  'Delivery Status', 'Payment Status', 'Sub Total', 'Shipping Cost',
  'Product ID', 'Product Name', 'Product MetaData', 'Product Color',
  'Product Quantity', 'Product Selling Price', 'Product Total Selling Price'
]);


// Iterate over products and append each to values array
orderData.products.forEach((product, index) => {
  if (index === 0) {
    values.push([
      orderData.orderDate,
      nextOrderNumber,
      orderData.paymentMethod,
      orderData.totalAmount,
      orderData.billingAddress.name,
      orderData.billingAddress.mobileNumber,
      orderData.billingAddress.address,
      orderData.userNotes,
      orderData.deliveryStatus,
      orderData.paymentStatus,
      orderData.subTotal,
      orderData.shippingCost,
      product.id,
      product.name,
      product.metaData,
      product.color,
      product.quantity,
      product.sellingPrice,
      product.totalSellingPrice
    ]);
  } else {
    values.push([
      '', '', '', '', '', '', '', '', '', '', '', '',  // Blank placeholders for order data fields
      product.id,
      product.name,
      product.metaData,
      product.color,
      product.quantity,
      product.sellingPrice,
      product.totalSellingPrice
    ]);
  }
});


      // Write row(s) to spreadsheet
      await googleSheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Sheet1', // Replace with your sheet name and range
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: values,
        },
      });

      console.log('Successfully submitted sheet! Thank you!');

      console.log('New order saved successfully:', savedOrder);
      return res.status(200).json({ message: 'Order received successfully', order: savedOrder });
    }
  } catch (error) {
    console.error('Error saving/updating order:', error);
    return res.status(500).json({ error: 'Failed to save/update order' });
  }
});


// GET route to render order success page
app.get('/order-confirmation/:id', async (req, res) => {
  try {
    const id = req.params.id;

    const order = await Order.findById(id);
console.log(order)
    const cart = req.session.cart;
    if (!order) {
      console.error('Order not found');
      return res.status(404).send('Order not found');
    }

    res.render('home/order-success', { order, cart });
  } catch (error) {
    console.error('Error retrieving order:', error);
    res.status(500).send('Internal Server Error');
  }
});



// GET route to render order success page
app.get('/admin/order-update/:id', async (req, res) => {
  try {
    const id = req.params.id;

//     // Find the order by its ID
    const order = await Order.findById(id);
console.log(order)
    if (!order) {
      // If order is not found, handle appropriately (redirect or error message)
      console.error('Order not found');
      return res.status(404).send('Order not found');
    }

//     // Render the order success page with order details
    res.render('home/admin-order-update', { order });
  } catch (error) {
    console.error('Error retrieving order:', error);
    res.status(500).send('Internal Server Error');
  }
});




app.get('/checkout', async (req, res) => {
  try {
    
    const cart = req.session.cart;
    res.render('home/checkout', { cart });

  } catch (error) {
      console.error('Error retrieving product:', error);
      res.status(500).send('Internal Server Error');
  }
});



app.post("/checkout", async (req, res) => {
  const { request, name } = req.body;
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: "https://www.googleapis.com/auth/spreadsheets",
  });

  // Create client instance for auth
  const client = await auth.getClient();

  // Instance of Google Sheets API
  const googleSheets = google.sheets({ version: "v4", auth: client });

  const spreadsheetId = "1XK_4b2lSt20cs9iyLvFVoJY98RbaIbDgciG7XQHagKo";

  // Get metadata about spreadsheet
  const metaData = await googleSheets.spreadsheets.get({
    auth,
    spreadsheetId,
  });

  // Read rows from spreadsheet
  const getRows = await googleSheets.spreadsheets.values.get({
    auth,
    spreadsheetId,
    range: "Sheet1!A:A",
  });

  // Write row(s) to spreadsheet
  await googleSheets.spreadsheets.values.append({
    auth,
    spreadsheetId,
    range: "Sheet1!A:B",
    valueInputOption: "USER_ENTERED",
    resource: {
      values: [[request, name ,"hello"]],
    },
  });

  res.send("Successfully submitted! Thank you!");
});



app.get('/admin/single-product-update/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findOne({ slug: id });
        if (product) {
          console.log(product)
            res.render('admin/Single-product-update', { product });
        } else {
            res.render('home/404');
        }
    } catch (error) {
        console.error('Error retrieving product:', error);
        res.status(500).send('Internal Server Error');
    }
});



app.post('/admin/single-product-update', async (req, res) => {
  const {
      id,
      name,
      slug,
      productCode,
      shortDescription,
      description,
      category,
      regularPrice,
      discountPrice,
      insideDhaka,
      outsideDhaka,
      stockQuantity,
      previewImage,
      brand,
      tags,
      video,
      handlingTime,
      isBestSeller,
      isNewArrival,
      isFeatured,
      isFreeDelivery,
      isVisible,
      isInStock
  } = req.body;

  console.log(req.body.regularPrice)
  try {
      // Generate slug from name
      // Convert 'on' to true, any other value to false
      const parseBoolean = (value) => value === 'on';

      // Check if the product already exists
      const existingProduct = await Product.findOne({ _id: id });

      if (existingProduct) {

        // Update the existing product
          await Product.updateOne({ _id:id }, {
              $set: {
                  name,
                  slug,
                  productCode,
                  shortDescription,
                  description,
                  category,
                  regularPrice,
                  discountPrice,
                  insideDhaka,
                  outsideDhaka,
                  stockQuantity,
                  previewImage,
                  brand,
                  tags,
                  video,
                  handlingTime,
                  isBestSeller: isBestSeller ? parseBoolean(isBestSeller) : false,
                  isNewArrival: isNewArrival ? parseBoolean(isNewArrival) : false,
                  isFeatured: isFeatured ? parseBoolean(isFeatured) : false,
                  isFreeDelivery: isFreeDelivery ? parseBoolean(isFreeDelivery) : false,
                  isVisible: isVisible ? parseBoolean(isVisible) : false,
                  isInStock: isInStock ? parseBoolean(isInStock) : false
              }
          });

          console.log('Product updated:', existingProduct);
          res.redirect(`/admin/single-product-update/${slug}`);
      } else {
        const slug = slugify(name, { lower: true });
          // Product doesn't exist, save a new one
          const newProduct = new Product({
              name,
              slug,
              productCode,
              shortDescription,
              description,
              category,
              regularPrice,
              discountPrice,
              insideDhaka,
              outsideDhaka,
              stockQuantity,
              previewImage,
              brand,
              tags,
              video,
              handlingTime,
              isBestSeller: isBestSeller ? parseBoolean(isBestSeller) : false,
              isNewArrival: isNewArrival ? parseBoolean(isNewArrival) : false,
              isFeatured: isFeatured ? parseBoolean(isFeatured) : false,
              isFreeDelivery: isFreeDelivery ? parseBoolean(isFreeDelivery) : false,
              isVisible: isVisible ? parseBoolean(isVisible) : false,
              isInStock: isInStock ? parseBoolean(isInStock) : false
          });

          await newProduct.save();
          console.log('New product created:', newProduct);
          res.redirect(`/admin/single-product-update/${slug}`);
      }
  } catch (error) {
      console.error('Error saving or updating product:', error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Define a route to handle the POST request to update the value
app.post('/update-preview-image', async (req, res) => {
  const {id, previewImage} = req.body;

  try {

console.log(req.body)
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: id },
      { $set: { previewImage: previewImage } },
      { upsert: true, new: true }
  );
  console.log('Updated Product:', updatedProduct); // Log updated data to console

    res.status(200).json({ message: 'Value updated successfully' }); // Sending JSON response
  } catch (error) {
      res.status(500).json({ error: 'Error updating value' }); // Sending JSON response
  }
});


app.get('/admin/product-list', async (req, res) => {
  try {
      const products = await Product.find().sort({ createdAt: 1 }).exec();

      res.render('admin/product-list', { products });
  } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('/admin/search-products', async (req, res) => {
  const searchQuery = req.query.query;
  console.log(searchQuery)
  try {
    // Retrieve filtered data from the database based on the search query
    const filteredProducts = await Product.find({ name: { $regex: searchQuery, $options: 'i' } }).sort({ createdAt: -1 });
    res.json(filteredProducts);
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.post('/search', async (req, res) => {
  const searchQuery = req.body.query;
  console.log(searchQuery)
  try {
    // Retrieve filtered data from the database based on the search query
    const filteredProducts = await Product.find({ name: { $regex: searchQuery, $options: 'i' } }).sort({ createdAt: -1 });
    res.json(filteredProducts);
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('/search', async (req, res) => {
  const searchQuery = req.query.query;
  console.log(searchQuery)
  try {
    // Retrieve filtered data from the database based on the search query
    const filteredProducts = await Product.find({ name: { $regex: searchQuery, $options: 'i' } }).sort({ createdAt: -1 });
    res.json(filteredProducts);
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/images');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });




// Handle image upload
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const product_id = req.query.id;
    console.log(product_id);

    // Find the product by product_id or create a new one if it doesn't exist
    let product = await Product.findOne({ _id: product_id });

    // If product doesn't exist, create a new one
    if (!product) {
      product = new Product({ _id: product_id });
    }

    if (req.file) {
      const { color, colorCode } = req.body;
console.log(req.body);
      product.images.push({
        filename: req.file.filename,
        color: color,
        colorCode: colorCode,
      });
    }

    // Save the product to the database
    await product.save();

    // Send the list of uploaded images in the response
    const images = product.images;
    console.log(images);
    res.status(200).json({ images });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

  // Handle image removal
  app.post('/remove', async (req, res) => {
    const { imageUrl } = req.body;

    try {
        await Product.updateOne({ _id: req.query.id }, { $pull: { images: { filename: imageUrl } } });
        
        console.log('Image removed:', imageUrl);
        res.status(200).json({ success: true, message: 'Image removed successfully' });
    } catch (error) {
        console.error('Error removing image:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }


  });







    


// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

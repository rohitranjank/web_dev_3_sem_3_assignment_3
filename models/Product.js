const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Product name is required"],
            trim: true,
            minlength: [2, "Name must contain at least 2 characters"]
        },

        description: {
            type: String,
            trim: true,
            default: ""
        },

        category: {
            type: String,
            required: [true, "Category is required"],
            trim: true
        },

        price: {
            type: Number,
            required: [true, "Price is required"],
            min: [0, "Price cannot be negative"]
        },

        quantity: {
            type: Number,
            required: [true, "Quantity is required"],
            min: [0, "Quantity cannot be negative"],
            validate: {
                validator: Number.isInteger,
                message: "Quantity must be an integer"
            }
        },

        sku: {
            type: String,
            required: [true, "SKU is required"],
            unique: true,
            trim: true,
            uppercase: true
        },

        supplier: {
            type: String,
            trim: true,
            default: "Unknown"
        }
    },
    {
        timestamps: true
    }
);

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
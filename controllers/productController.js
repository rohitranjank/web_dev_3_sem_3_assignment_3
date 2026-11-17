const mongoose = require("mongoose");
const Product = require("../models/Product");

const createProduct = async (req, res, next) => {
    try {
        const product = await Product.create(req.body);

        res.status(201).json({
            success: true,
            message: "Product created successfully",
            data: product
        });
    } catch (error) {
        next(error);
    }
};

const getAllProducts = async (req, res, next) => {
    try {
        const {
            category, name, minPrice, maxPrice,
            sortBy = "createdAt",
            order = "desc",
            page = 1,
            limit = 10
        } = req.query;

        const filter = {};

        if (category) filter.category = category;

        if (name) {
            filter.name = {
                $regex: name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                $options: "i"
            };
        }

        if (minPrice !== undefined || maxPrice !== undefined) {
            filter.price = {};

            if (minPrice !== undefined) {
                filter.price.$gte = Number(minPrice);
            }

            if (maxPrice !== undefined) {
                filter.price.$lte = Number(maxPrice);
            }

            if (
                (minPrice !== undefined && !Number.isFinite(Number(minPrice))) ||
                (maxPrice !== undefined && !Number.isFinite(Number(maxPrice))) ||
                (filter.price.$gte !== undefined && filter.price.$gte < 0) ||
                (filter.price.$lte !== undefined && filter.price.$lte < 0) ||
                (filter.price.$gte > filter.price.$lte)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid price range"
                });
            }
        }

        const currentPage = Math.max(1, parseInt(page) || 1);
        const pageLimit = Math.min(100, Math.max(1, parseInt(limit) || 10));

        const allowedFields = [
            "name", "price", "quantity", "createdAt", "category"
        ];

        const field = allowedFields.includes(sortBy) ? sortBy : "createdAt";
        const sortOrder = order === "asc" ? 1 : -1;

        const [products, totalProducts] = await Promise.all([
            Product.find(filter)
                .sort({ [field]: sortOrder })
                .skip((currentPage - 1) * pageLimit)
                .limit(pageLimit)
                .lean(),

            Product.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            totalProducts,
            currentPage,
            totalPages: Math.ceil(totalProducts / pageLimit),
            data: products
        });

    } catch (error) {
        next(error);
    }
};

const getProductById = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        const product = await Product.findById(id).lean();

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.status(200).json({
            success: true,
            data: product
        });

    } catch (error) {
        next(error);
    }
};

const updateProduct = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        const allowedFields = [
            "name", "description", "category",
            "price", "quantity", "sku", "supplier"
        ];

        const updateData = {};

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid fields provided"
            });
        }

        const product = await Product.findByIdAndUpdate(
            id,
            updateData,
            {
                new: true,
                runValidators: true
            }
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Product updated successfully",
            data: product
        });

    } catch (error) {
        next(error);
    }
};

const adjustStock = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { quantityChange } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        if (!Number.isInteger(quantityChange) || quantityChange === 0) {
            return res.status(400).json({
                success: false,
                message: "Quantity change must be a non-zero integer"
            });
        }

        const product = await Product.findOneAndUpdate(
            {
                _id: id,
                quantity: {
                    $gte: Math.max(0, -quantityChange)
                }
            },
            {
                $inc: { quantity: quantityChange }
            },
            { new: true }
        );

        if (!product) {
            const exists = await Product.exists({ _id: id });

            return res.status(exists ? 400 : 404).json({
                success: false,
                message: exists ? "Insufficient stock" : "Product not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Stock adjusted successfully",
            data: product
        });

    } catch (error) {
        next(error);
    }
};

const deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        const product = await Product.findByIdAndDelete(id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Product deleted successfully",
            data: product
        });

    } catch (error) {
        next(error);
    }
};

const getLowStockProducts = async (req, res, next) => {
    try {
        const threshold = Number(req.query.threshold ?? 5);

        if (!Number.isFinite(threshold) || threshold < 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid threshold"
            });
        }

        const products = await Product.find({
            quantity: { $lte: threshold }
        })
        .sort({ quantity: 1 })
        .lean();

        res.status(200).json({
            success: true,
            threshold,
            totalLowStockProducts: products.length,
            data: products
        });

    } catch (error) {
        next(error);
    }
};

const getCategorySummary = async (req, res, next) => {
    try {
        const summary = await Product.aggregate([
            {
                $group: {
                    _id: "$category",
                    totalProducts: { $sum: 1 },
                    totalQuantity: { $sum: "$quantity" },
                    totalInventoryValue: {
                        $sum: {
                            $multiply: ["$price", "$quantity"]
                        }
                    },
                    averagePrice: { $avg: "$price" }
                }
            },
            {
                $project: {
                    _id: 0,
                    category: "$_id",
                    totalProducts: 1,
                    totalQuantity: 1,
                    totalInventoryValue: 1,
                    averagePrice: 1
                }
            },
            {
                $sort: { category: 1 }
            }
        ]);

        res.status(200).json({
            success: true,
            totalCategories: summary.length,
            data: summary
        });

    } catch (error) {
        next(error);
    }
};


module.exports = {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    adjustStock,
    deleteProduct,
    getLowStockProducts,
    getCategorySummary
};
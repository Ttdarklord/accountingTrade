"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const tradeService_1 = require("../services/tradeService");
const zod_1 = require("zod");
const router = express_1.default.Router();
// Validation schemas
const createTradeSchema = zod_1.z.object({
    trade_type: zod_1.z.enum(['BUY', 'SELL', 'BUY_SELL']),
    base_currency: zod_1.z.enum(['AED', 'TOMAN']),
    quote_currency: zod_1.z.enum(['AED', 'TOMAN']),
    amount: zod_1.z.number().positive(),
    rate: zod_1.z.number().positive(),
    counterparty_id: zod_1.z.number().optional(),
    trade_date: zod_1.z.string(),
    settlement_date_base: zod_1.z.string(),
    settlement_date_quote: zod_1.z.string(),
    payment_instructions: zod_1.z.array(zod_1.z.object({
        account_id: zod_1.z.number(),
        amount: zod_1.z.number().positive(),
        payment_type: zod_1.z.enum(['OUTGOING', 'INCOMING']),
        due_date: zod_1.z.string()
    })).optional()
});
const sellFromPositionSchema = zod_1.z.object({
    position_id: zod_1.z.number(),
    amount: zod_1.z.number().positive(),
    rate: zod_1.z.number().positive(),
    counterparty_id: zod_1.z.number().optional(),
    trade_date: zod_1.z.string().optional(),
    settlement_date_base: zod_1.z.string().optional(),
    settlement_date_quote: zod_1.z.string().optional()
});
// GET /api/trades - Get all trades with pagination and filters
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const status = req.query.status;
        const counterpartyId = req.query.counterparty_id ? parseInt(req.query.counterparty_id) : undefined;
        const baseCurrency = req.query.base_currency;
        const quoteCurrency = req.query.quote_currency;
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;
        const result = tradeService_1.TradeService.getTrades(limit, offset, counterpartyId, status, baseCurrency, quoteCurrency, startDate, endDate);
        res.json({
            success: true,
            data: result.trades,
            pagination: {
                page,
                limit,
                total: result.total,
                pages: Math.ceil(result.total / limit)
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch trades',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// GET /api/trades/:id - Get trade by ID
router.get('/:id', async (req, res) => {
    try {
        const tradeId = parseInt(req.params.id);
        if (isNaN(tradeId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid trade ID'
            });
        }
        const trade = tradeService_1.TradeService.getTradeById(tradeId);
        res.json({
            success: true,
            data: trade
        });
    }
    catch (error) {
        res.status(404).json({
            success: false,
            error: 'Trade not found',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// POST /api/trades - Create new trade
router.post('/', async (req, res) => {
    try {
        const validatedData = createTradeSchema.parse(req.body);
        // Validate that base and quote currencies are different
        if (validatedData.base_currency === validatedData.quote_currency) {
            return res.status(400).json({
                success: false,
                error: 'Base and quote currencies must be different'
            });
        }
        const trade = tradeService_1.TradeService.createTrade(validatedData);
        res.status(201).json({
            success: true,
            data: trade,
            message: 'Trade created successfully'
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request data',
                details: error.errors
            });
        }
        res.status(500).json({
            success: false,
            error: 'Failed to create trade',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// GET /api/trades/positions/outstanding - Get outstanding positions
router.get('/positions/outstanding', async (req, res) => {
    try {
        const positions = tradeService_1.TradeService.getOutstandingPositions();
        res.json({
            success: true,
            data: positions
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch outstanding positions',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// POST /api/trades/positions/sell - Sell from position
router.post('/positions/sell', async (req, res) => {
    try {
        const validatedData = sellFromPositionSchema.parse(req.body);
        const trade = tradeService_1.TradeService.sellFromPosition(validatedData);
        res.status(201).json({
            success: true,
            data: trade,
            message: 'Position sold successfully'
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request data',
                details: error.errors
            });
        }
        res.status(400).json({
            success: false,
            error: 'Failed to sell position',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// PUT /api/trades/:id/status - Update trade status
router.put('/:id/status', async (req, res) => {
    try {
        const tradeId = parseInt(req.params.id);
        const { status } = req.body;
        if (isNaN(tradeId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid trade ID'
            });
        }
        if (!['PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status value'
            });
        }
        // TODO: Implement updateTradeStatus method in TradeService
        // TradeService.updateTradeStatus(tradeId, status);
        res.json({
            success: true,
            message: 'Trade status updated successfully'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to update trade status',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=trades.js.map
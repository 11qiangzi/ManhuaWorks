/**
 * 路由聚合
 */

import { Router } from "express";
import healthController from "../controllers/healthController";
import subscriptionController from "../controllers/subscriptionController";
import orderController from "../controllers/orderController";
import invoiceController from "../controllers/invoiceController";
import paymentController from "../controllers/paymentController";
import quotaController from "../controllers/quotaController";
import refundController from "../controllers/refundController";
import costLogController from "../controllers/costLogController";
import rechargeRouter from "./recharge";
import { billingAdminRouter } from "./admin";

const router = Router();

router.use("/", healthController);
router.use("/subscriptions", subscriptionController);
router.use("/orders", orderController);
router.use("/invoices", invoiceController);
router.use("/payment", paymentController);
router.use("/quota", quotaController);
router.use("/refunds", refundController);
router.use("/billing/cost-logs", costLogController);
// L5-D: 真实账号 + 充值（mock 支付，5 步流程）
router.use("/billing", rechargeRouter);

// admin billing
router.use("/admin/billing", billingAdminRouter);

export default router;

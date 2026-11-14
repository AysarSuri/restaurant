import { Router, type IRouter } from "express";
import healthRouter from "./health";
import menuRouter from "./menu";
import tablesRouter from "./tables";
import ordersRouter from "./orders";
import customersRouter from "./customers";
import employeesRouter from "./employees";
import inventoryRouter from "./inventory";
import expensesRouter from "./expenses";
import branchesRouter from "./branches";
import cardsRouter from "./cards";
import settingsRouter from "./settings";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/menu", menuRouter);
router.use("/tables", tablesRouter);
router.use("/orders", ordersRouter);
router.use("/customers", customersRouter);
router.use("/employees", employeesRouter);
router.use("/inventory", inventoryRouter);
router.use("/expenses", expensesRouter);
router.use("/branches", branchesRouter);
router.use("/cards", cardsRouter);
router.use("/settings", settingsRouter);
router.use("/reports", reportsRouter);

export default router;

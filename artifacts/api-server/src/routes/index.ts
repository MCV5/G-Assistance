import { Router, type IRouter } from "express";
import healthRouter from "./health";
import groceriesRouter from "./groceries";

const router: IRouter = Router();

router.use(healthRouter);
router.use(groceriesRouter);

export default router;

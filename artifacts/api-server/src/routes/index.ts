import { Router, type IRouter } from "express";
import healthRouter from "./health";
import groceriesRouter from "./groceries";
import authRouter from "./auth";
import meRouter from "./me";

const router: IRouter = Router();

router.use(healthRouter);
router.use(groceriesRouter);
router.use(authRouter);
router.use(meRouter);

export default router;

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import projectsRouter from "./projects";
import secretsRouter from "./secrets";
import snapshotsRouter from "./snapshots";
import deploymentsRouter from "./deployments";
import exploreRouter from "./explore";
import githubPushRouter from "./github-push";
import domainsRouter from "./domains";
import adminRouter from "./admin";
import { kvRouter } from "./db";
import accountRouter from "./account";
import stripeRouter from "./stripe";
import collabRouter from "./collab";
import referralRouter from "./referral";
import orgsRouter from "./orgs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(projectsRouter);
router.use(secretsRouter);
router.use(snapshotsRouter);
router.use(deploymentsRouter);
router.use(exploreRouter);
router.use(githubPushRouter);
router.use(domainsRouter);
router.use(adminRouter);
router.use(kvRouter);
router.use(accountRouter);
router.use(stripeRouter);
router.use(collabRouter);
router.use(referralRouter);
router.use(orgsRouter);

export default router;

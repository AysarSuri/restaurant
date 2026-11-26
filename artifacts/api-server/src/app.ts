import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { ensureCategoryUploadsDir, UPLOADS_ROOT } from "./lib/category-image";
import { ensureSalesDeviceColumns } from "./lib/ensure-sales-columns";
import { ensureEmployeeColumns } from "./lib/ensure-employee-columns";
import { ensureVaultColumns } from "./lib/ensure-vault-columns";

const app: Express = express();

ensureCategoryUploadsDir();
void ensureSalesDeviceColumns();
void ensureEmployeeColumns();
void ensureVaultColumns();
app.use("/uploads", express.static(UPLOADS_ROOT));

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.use("/api", router);

export default app;

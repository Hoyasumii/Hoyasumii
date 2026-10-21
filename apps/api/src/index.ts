import { createApp } from "./app";
import { depsFromEnv } from "./container";

export default createApp(depsFromEnv);

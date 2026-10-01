/*
 * Copyright 2026 Christian Grobmeier
 * Licensed under the Apache License, Version 2.0.
 */
import coreData from "./core.json";
import { catalogue, parsePack } from "./model";
export const CORE_PACK = parsePack(JSON.stringify(coreData));
export const CORE_CATALOG = catalogue([CORE_PACK], "core:1.0.0");

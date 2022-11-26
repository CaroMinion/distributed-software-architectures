import express = require("express");
import {createMenu, getMenuItemPrices} from "./menu";
import { getPossibleDelay } from "./utils";

const port = parseInt(process.env.PORT, 10) || 3000;

const app = express();

app.get("/menu", async (req, res) => {
    const menu = await createMenu()
    console.log("Manager:" + menu);
    res.json(menu);
});

app.get("/prices", async (req, res) => {
    await getPossibleDelay();
    const prices = await getMenuItemPrices()
    
    if(!prices?.drinks?.length || !prices?.food?.length){
        res.status(404);
        return res.send()
    }

    res.json(prices);
})

app.listen(port, () => {
    console.log(`Server running on port http://localhost:${port}`);
});
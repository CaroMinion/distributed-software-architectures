import {Console} from "console";
import fetch from "node-fetch";
import {Log, LOG_TYPE, Order} from "./types";
import amqp, {connect} from "amqplib";
import {createConnection} from "net";

let orderNumber = 1;
const averageWaitingTimePerGuest = 4;
let waitingTime: number;
let connection: amqp.Connection;
const forgetfulnessThreshold =
    parseFloat(process.env.FORGETTABLE_WAITER_RATIO) || 0.1;
    

export async function processOrder(order: Order) {
    await sendOrder(order);


    // const highestOrderPosition = await sendFoodToFoodPreparation(order);
    // await sendOrderToDelivery(order);
    if(waitingTime) {
        return { waitingTime, order: orderNumber - 1 };
    }
    const wait = calculateWaitingTime(order.food.length);
    return { waitingTime: wait, order: orderNumber - 1 };
}

// async function sendOrderToDelivery(order: Order) {
//   const sentOrder = {
//     guest: order.guest,
//     food: order.food,
//     drinks: order.drinks || [],
//     order: orderNumber,
//   };
//   orderNumber++;
//   fetch("http://Delivery:8084/orderInformation", {
//     method: "POST",
//     body: JSON.stringify(sentOrder),
//     headers: { "Content-Type": "application/json" },
//   });
// }

async function sendOrder(order: Order) {
    const iForgot = Math.random();
    const processedOrder = {
        guest: order.guest,
        food: order.food || [],
        drinks: order.drinks || [],
        order: orderNumber,
    };
    orderNumber++;

    if (iForgot <= forgetfulnessThreshold) {
        console.log("Duplicated order is being sent");
        await sendPlacedOrder(processedOrder);
        await sendPlacedOrder(processedOrder);
    } else {
        await sendPlacedOrder(processedOrder);
    }
}

function calculateWaitingTime(highestOrderPosition: number) {
    let waitingTime = highestOrderPosition * averageWaitingTimePerGuest;
    return waitingTime;
}

async function connectToRabbitMq() {
    try {
        const connection = await connect({
            hostname: "RabbitMQ",
            port: 5672,
            username: process.env.RABBITMQ_DEFAULT_USER || "admin",
            password: process.env.RABBITMQ_DEFAULT_PASS || "admin1234",
        });
        console.log({
            type: LOG_TYPE.INFO,
            timestamp:Date.now(),
            serviceName: "tableService",
            event: {
                method: "connectToRabbitMq",
                message: "Successfully connected to RabbitMQ"
            }
        } as Log);
        return connection;
    } catch (error) {
        console.error("Error connecting to RabbitMQ:", error);
        console.log({
            type: LOG_TYPE.ERROR,
            timestamp:Date.now(),
            serviceName: "TableService",
            event: {
                method: "connectToRabbitMq",
                message: "Error connecting to RabbitMQ"
            }
        } as Log);
    }
}

async function sendPlacedOrder(order: any) {
    try {
        if (!connection) {
            connection = await connectToRabbitMq();
        }
        const channel = await connection.createChannel();

        const exchange = "placedOrder";

        await channel.assertExchange(exchange, "fanout", {durable: true});

        const routingKey = "newOrder";
        const eventBuffer = Buffer.from(JSON.stringify(order));
        channel.publish(exchange, "", eventBuffer);

        /* setTimeout(function () {
            connection.close();
        }, 500); */
    } catch (error) {
        console.log({
            type: LOG_TYPE.INFO,
            timestamp:Date.now(),
            serviceName: "TableService",
            event: {
                method: "publishToQueue placedOrder",
                order: order,
                message: "Error sending message to RabbitMQ"
            }
        } as Log);
    }
}

async function listenForWaitingTime() {
    if (!connection) {
        connection = await connectToRabbitMq();
    }
    const channel = await connection.createChannel();
    await channel.assertQueue("updateWaitingTime", {durable: true});
    channel.consume("updateWaitingTime", (message: any) => {
        const highestOrderPosition = JSON.parse(message.content.toString());
        console.log({
            type: LOG_TYPE.INFO,
            timestamp:Date.now(),
            serviceName: "TableService",
            event: {
                method: "consume updateWaitingTime",
                message: "Received Message for queue updateWaitingTime" + highestOrderPosition
            }
        } as Log);
        waitingTime = calculateWaitingTime(highestOrderPosition);
    });
}
listenForWaitingTime();

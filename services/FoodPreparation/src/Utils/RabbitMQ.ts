import amqp, { connect } from "amqplib";

export default class RabbitMQ  {
    connection: amqp.Connection;
    static instance: RabbitMQ;
    constructor() {
        this.connectToRabbitMq();
    }
    static getInstance() {
        if(!this.instance) {
            this.instance = new RabbitMQ();
        }
        return this.instance;
    }

    async connectToRabbitMq() {
        try {
            this.connection = await connect({
                hostname: "RabbitMQ",
                port: 5672,
                username: process.env.RABBITMQ_DEFAULT_USER || "admin",
                password: process.env.RABBITMQ_DEFAULT_PASS || "admin1234"
            });
            console.log("Successfully connected to RabbitMQ");
        } catch (error) {
            console.error("Error connecting to RabbitMQ:", error);
        }
    }
    
    async sendMessage(queueName: string, message: any ) {
        try {
            if (!this.connection) { 
                await this.connectToRabbitMq();
            }
            const channel = await this.connection.createChannel();
            const routingKey = "my-routing-key";
    
            await channel.assertQueue(queueName, { durable: true });
            channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)));
            console.log(`Sent message: ${message}`);
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            // await this.connection.close();
        }
    }
    async consumeEvent(queueName: string, callback: (msg: amqp.Message) => void) {
        try {
            if (!this.connection) { 
                await this.connectToRabbitMq();
            }
            const channel = await this.connection.createChannel();
            const queue = await channel.assertQueue('', { exclusive: true });
            await channel.assertExchange(queueName, 'fanout', { durable: false });
            channel.bindQueue(queue.queue, queueName, '');
            channel.consume(queue.queue, (msg: amqp.Message) => {
                if (msg !== null) {
                  console.log('Recieved:', JSON.parse(msg.content.toString()));
                  callback(msg);
                } else {
                  console.log('Consumer cancelled by server');
                }
              }, { noAck: true });
        } catch (error) {
            console.error("Error consuming message:", error);
        }
    }
  
}
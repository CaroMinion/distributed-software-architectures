import { Bill, ItemRegistration, Menu, PaidBill, PAYMENT_METHOD } from "./types/types";
import fetch from "node-fetch";
import { menuMock } from "./mocks";

export default class BillingService {
	bills: Bill[] = [];
	deliveredItems: ItemRegistration[] = [];
	menu: Menu;
	billIdCounter: number = 1;

	constructor() {
		// just for testing
		this.menu = menuMock;

		/*this.getMenu()
			.then(menu => this.menu = menu);*/
	}

	private async getMenu(): Promise<Menu> {
		// get menu from guest experience

		const path = `${process.env.API_GUEST_EXPERIENCE || "GuestExperience"}:${process.env.PORT_GUEST_EXPERIENCE || "8081"}/prices`;
		const response = await fetch(path);
		return await response.json();
	}

	generateBill(guestDelivery: ItemRegistration): Bill {
		// generate a bill from the unpaid items left for a certain customer

		const newBill: Bill = {
			bill: this.billIdCounter,
			order: guestDelivery.order,
			orderedDrinks: [],
			orderedFood: [],
			totalSum: 0
		};

		this.billIdCounter++;

		guestDelivery.drinks.forEach(id => {
			const menuDrink = this.menu.drinks.find(drink => drink.id === id);

			newBill.orderedDrinks.push(menuDrink.id);
			newBill.totalSum += menuDrink.price;
		});

		guestDelivery.food.forEach(id => {
			const menuFood = this.menu.food.find(food => food.id === id);

			newBill.orderedFood.push(menuFood.id);
			newBill.totalSum += menuFood.price;
		});

		this.bills.push(newBill);

		// copy bill to delete not needed property
		const tempBill = { ...newBill };
		delete tempBill.order;

		return tempBill;
	}

	getPaymentOption(amount: number): PAYMENT_METHOD[] {
		// return the available payment options depending on the price

		const paymentMethods = [PAYMENT_METHOD.Cash];

		if (amount < 20) return paymentMethods;

		return [...paymentMethods, PAYMENT_METHOD.DebitCard, PAYMENT_METHOD.CreditCard];
	}

	registerPayment(billId: number) {
		// register a new payment and mark items as paid

		const billIndex = this.bills.findIndex(bill => bill.bill === billId);

		const { order, orderedDrinks: paidDrinks, orderedFood: paidFood, totalSum } = this.bills[billIndex];

		// TODO: why is it called paidOrders and is an array? A bill will always only cover one order
		const paidBill: PaidBill = {
			bill: billId,
			paidOrders: [{
				order,
				paidDrinks,
				paidFood
			}],
			totalSum
		};

		this.bills.splice(billIndex, 1);

		return paidBill;
	}

	registerDeliveredItems(itemRegistration: ItemRegistration) {
		// register items which are delivered to a guest

		const { guest, food, drinks } = itemRegistration;

		const guestItems = this.deliveredItems.find(items => items.guest === guest);

		if (guestItems) {
			guestItems.food = guestItems.food.concat(food);
			guestItems.drinks = guestItems.drinks.concat(drinks);
		} else {
			this.deliveredItems.push(itemRegistration);
		}
	}
}

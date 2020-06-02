import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import { IProduct as IProductDTO } from '@modules/orders/dtos/ICreateOrderDTO';
import IUpdateProductsQuantityDTO from '@modules/products/dtos/IUpdateProductsQuantityDTO';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const createOrderProducts: IProductDTO[] = [];
    const newQuantityProducts: IUpdateProductsQuantityDTO[] = [];

    const customer = await this.customersRepository.findById(customer_id);
    if (!customer) {
      throw new AppError('This customer does not exists');
    }

    const findProducts = await this.productsRepository.findAllById(products);

    // Filter if has invalid product ids on request
    const invalidProducts = products.filter(product => {
      const findProductsMatch = findProducts.some(
        findProductMatch => findProductMatch.id === product.id,
      );

      return !findProductsMatch;
    });
    if (invalidProducts.length) {
      const ids = invalidProducts
        .map(invalidProduct => invalidProduct.id)
        .join(', ');

      throw new AppError(`Invalid product(s): ${ids}`);
    }

    // Filter if has too much quantity out of stock products on request
    const outOfStockProducts = products.filter(product => {
      const findProductsMatch = findProducts.some(
        findProductMatch => findProductMatch.quantity < product.quantity,
      );

      return findProductsMatch;
    });
    if (outOfStockProducts.length) {
      const ids = outOfStockProducts
        .map(outOfStockProduct => outOfStockProduct.id)
        .join(', ');

      throw new AppError(`We don't have enough stock for product(s): ${ids}`);
    }

    // Create product object for ordersRepository.create
    products.forEach(product => {
      const findProduct = findProducts.find(({ id }) => id === product.id);

      if (findProduct) {
        createOrderProducts.push({
          ...product,
          product_id: product.id,
          price: findProduct.price,
        });

        newQuantityProducts.push({
          ...product,
          quantity: findProduct.quantity - product.quantity,
        });
      }
    });

    // Decrement product total quantity
    await this.productsRepository.updateQuantity(newQuantityProducts);

    // Create order
    const order = await this.ordersRepository.create({
      customer,
      products: createOrderProducts,
    });

    return {
      ...order,
      customer,
    };
  }
}

export default CreateOrderService;

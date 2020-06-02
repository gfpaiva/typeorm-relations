import { Router } from 'express';
import { celebrate, Joi, Segments } from 'celebrate';

import OrdersController from '../controller/OrdersController';

const ordersRouter = Router();
const ordersController = new OrdersController();

ordersRouter.post(
  '/',
  celebrate({
    [Segments.BODY]: {
      customer_id: Joi.string().uuid().required(),
      products: Joi.array().items(
        Joi.object({
          id: Joi.string().uuid().required(),
          quantity: Joi.number().required(),
        })
          .strict()
          .required(),
      ),
    },
  }),
  ordersController.create,
);
ordersRouter.get(
  '/:id',
  celebrate({
    [Segments.PARAMS]: {
      id: Joi.string().uuid().required(),
    },
  }),
  ordersController.show,
);

export default ordersRouter;

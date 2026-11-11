import { handle } from '../../backend/api.js';
export const onRequest = context => handle(context.request,context.env,context);

import { handle } from '../../backend/api.js';
export const onRequest = ({request,env}) => handle(request,env);

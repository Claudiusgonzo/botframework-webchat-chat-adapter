import { compose } from 'redux';

import { AdapterEnhancer, MiddlewareAPI } from '../types/AdapterTypes';
import extractAdapterAPI from '../extractAdapterAPI';

type Middleware<TActivity, TFunction> = (adapterAPI: MiddlewareAPI<TActivity>) => (next: TFunction) => TFunction;

// This will convert multiple middlewares into a single enhancer.
// Enhancer is another middleware for the constructor of adapter. Essentially HOC for adapter.
// We can chain multiple enhancer together, and plug-in multiple features to a single adapter.
// In the future, if we decided to change Adapter, middleware written by user can still be reused. We won't introduce breaking changes.
export default function createApplyMiddleware<TActivity, TFunction>(
  getFunction: (api: MiddlewareAPI<TActivity>) => TFunction,
  setFunction: (api: MiddlewareAPI<TActivity>, fn: TFunction) => MiddlewareAPI<TActivity>
) {
  return (...middlewares: Middleware<TActivity, TFunction>[]): AdapterEnhancer<TActivity> => {
    return nextCreator => options => {
      const adapter = nextCreator(options);

      if (Object.getPrototypeOf(adapter) !== Object.prototype) {
        throw new Error('One of the enhancer is returning the adapter as a class object. This is not supported.');
      }

      // TODO: We should change type "any" to "TFunction"
      let fn: any = () => {
        throw new Error(
          'Calling function while constructing your middleware is not allowed. Other middleware would not be applied to this function.'
        );
      };

      // TODO: We should change type "any" to "TFunction"
      const proxyFn: any = (...args: any[]) => fn(...args);

      const api: MiddlewareAPI<TActivity> = setFunction(extractAdapterAPI(adapter), proxyFn);
      const chain = middlewares.map(middleware => middleware(api));

      if (chain.some(fn => typeof fn !== 'function')) {
        throw new Error('All middlewares must return a function after caling with middleware API.');
      }

      fn = compose<TFunction>(...chain)(getFunction(adapter));

      return { ...adapter, ...setFunction(adapter, fn) };
    };
  };
}

export type { Middleware };

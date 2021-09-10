/**
 * Landofcoder
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the Landofcoder.com license that is
 * available through the world-wide-web at this URL:
 * https://landofcoder.com/license
 *
 * DISCLAIMER
 *
 * Do not edit or add to this file if you wish to upgrade this extension to newer
 * version in the future.
 *
 * @category   Landofcoder
 * @package    Lofmp_MultiShipping
 * @copyright  Copyright (c) 2021 Landofcoder (https://landofcoder.com/)
 * @license    https://landofcoder.com/LICENSE-1.0.html
 */

/*global define*/
define(
    [
        'jquery',
        "underscore",
        'ko'
    ],
    function (
        $
    ) {
        'use strict';
        return function (target) {
            if (window.checkoutConfig.sellermultishipping === undefined || window.checkoutConfig.onestepcheckout === undefined) {
                return target.extend({});
            }
            return target.extend({
                    defaults: {
                        template: 'Lofmp_MultiShippingOneStepCheckout/shipping'
                    }
                }
            );
        }
    }
);

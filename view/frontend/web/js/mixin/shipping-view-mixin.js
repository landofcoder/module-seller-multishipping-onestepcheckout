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
        'Magento_Ui/js/form/form',
        'ko',
        'Magento_Customer/js/model/customer',
        'Magento_Customer/js/model/address-list',
        'Magento_Checkout/js/model/address-converter',
        'Magento_Checkout/js/model/quote',
        'Magento_Checkout/js/action/create-shipping-address',
        'Magento_Checkout/js/action/select-shipping-address',
        'Magento_Checkout/js/model/shipping-rates-validator',
        'Magento_Checkout/js/model/shipping-address/form-popup-state',
        'Magento_Checkout/js/model/shipping-service',
        'Magento_Checkout/js/action/select-shipping-method',
        'Magento_Checkout/js/model/shipping-rate-registry',
        'Magento_Checkout/js/action/set-shipping-information',
        'Magento_Checkout/js/model/step-navigator',
        'Magento_Ui/js/modal/modal',
        'Magento_Checkout/js/model/checkout-data-resolver',
        'Magento_Checkout/js/checkout-data',
        'uiRegistry',
        'Magento_Catalog/js/price-utils',
        'mage/translate',
        'Magento_Checkout/js/model/shipping-rate-service',
        'mage/url'
    ],
    function (
        $,
        _,
        Component,
        ko,
        customer,
        addressList,
        addressConverter,
        quote,
        createShippingAddress,
        selectShippingAddress,
        shippingRatesValidator,
        formPopUpState,
        shippingService,
        selectShippingMethodAction,
        rateRegistry,
        setShippingInformationAction,
        stepNavigator,
        modal,
        checkoutDataResolver,
        checkoutData,
        registry,
        priceUtils,
        $t,
        rate_service,
        url
    ) {
        'use strict';
        var popUp = null;
        return function (target) {
            if (window.checkoutConfig.sellermultishipping === undefined) {
                return target.extend({});
            }
            return target.extend({
                    defaults: {
                        template: 'Lofmp_MultiShippingOneStepCheckout/shipping'
                    },
                    visible: ko.observable(!quote.isVirtual()),
                    errorValidationMessage: ko.observable(false),
                    isCustomerLoggedIn: customer.isLoggedIn,
                    isFormPopUpVisible: formPopUpState.isVisible,
                    isFormInline: addressList().length == 0,
                    isNewAddressAdded: ko.observable(false),
                    saveInAddressBook: 1,
                    quoteIsVirtual: quote.isVirtual(),
                    initialize: function () {
                        var self = this;
                        this._super();
                        checkoutDataResolver.resolveShippingAddress();

                        var hasNewAddress = addressList.some(
                            function (address) {
                                return address.getType() == 'new-customer-address';
                            }
                        );

                        this.isNewAddressAdded(hasNewAddress);

                        this.isFormPopUpVisible.subscribe(
                            function (value) {
                                if (value) {
                                    self.getPopUp().openModal();
                                }
                            }
                        );

                        quote.shippingMethod.subscribe(
                            function (value) {
                                self.errorValidationMessage(false);
                            }
                        );

                        registry.async('checkoutProvider')(function (checkoutProvider) {
                            var shippingAddressData = checkoutData.getShippingAddressFromData();
                            if (shippingAddressData) {
                                checkoutProvider.set(
                                    'shippingAddress',
                                    $.extend({}, checkoutProvider.get('shippingAddress'), shippingAddressData)
                                );
                            }
                            checkoutProvider.on(
                                'shippingAddress', function (shippingAddressData) {
                                    checkoutData.setShippingAddressFromData(shippingAddressData);
                                }
                            );
                        });
                        this.rates.subscribe(
                            function (grates) {
                                var items = quote.getItems();
                                var count = 0;
                                self.shippingRateGroups([]);
                                $.each(items, function (index, value) {
                                    var seller_id = [];
                                    seller_id = value.product.seller_id;
                                    if (self.shippingRateGroups.indexOf(seller_id) === -1) {
                                        self.shippingRateGroups.push(seller_id);
                                        count++;
                                    }
                                });
                                self.shippingRateGroups.sort();
                                window.sellerArray = count;
                                _.each(
                                    grates, function (rate) {
                                        if (rate['carrier_code'] === 'seller_rates') {
                                            if (rate['method_code'].indexOf("|") !== -1) {
                                                var result = rate['method_code'].split('|');
                                                var seller = result['0'] ? result['0'] : '';
                                                var method_code = result['1'] ? result['1'] : '';
                                                rate['seller_id'] = seller;
                                                rate['method_code'] = method_code;
                                            }
                                        }
                                    }
                                );
                            }
                        );
                        return this;
                    },
                    navigate: function () {
                        //load data from server for shipping step
                    },
                    initElement: function (element) {
                        if (element.index === 'shipping-address-fieldset') {
                            shippingRatesValidator.bindChangeHandlers(element.elems(), false);
                        }
                    },
                    getPopUp: function () {
                        var self = this;
                        if (!popUp) {
                            var buttons = this.popUpForm.options.buttons;
                            this.popUpForm.options.buttons = [
                                {
                                    text: buttons.save.text ? buttons.save.text : $t('Save Address'),
                                    class: buttons.save.class ? buttons.save.class : 'action primary action-save-address',
                                    click: self.saveNewAddress.bind(self)
                                },
                                {
                                    text: buttons.cancel.text ? buttons.cancel.text : $t('Cancel'),
                                    class: buttons.cancel.class ? buttons.cancel.class : 'action secondary action-hide-popup',
                                    click: function () {
                                        this.closeModal();
                                    }
                                }
                            ];
                            this.popUpForm.options.closed = function () {
                                self.isFormPopUpVisible(false);
                            };
                            popUp = modal(this.popUpForm.options, $(this.popUpForm.element));
                        }
                        return popUp;
                    },
                    showFormPopUp: function () {
                        this.isFormPopUpVisible(true);
                    },
                    saveNewAddress: function () {
                        this.source.set('params.invalid', false);
                        this.source.trigger('shippingAddress.data.validate');

                        if (!this.source.get('params.invalid')) {
                            var addressData = this.source.get('shippingAddress');
                            addressData.save_in_address_book = this.saveInAddressBook;

                            // New address must be selected as a shipping address
                            var newShippingAddress = createShippingAddress(addressData);
                            selectShippingAddress(newShippingAddress);
                            checkoutData.setSelectedShippingAddress(newShippingAddress.getKey());
                            checkoutData.setNewCustomerShippingAddress(addressData);
                            this.getPopUp().closeModal();
                            this.isNewAddressAdded(true);
                        }
                    },
                    /**
                     * Shipping Method View
                     **/
                    rates: shippingService.getShippingRates(),
                    shippingRateGroups: ko.observableArray([]),
                    isLoading: shippingService.isLoading,
                    total: ko.observable(0),
                    isSelected: ko.computed(
                        function () {
                            return quote.shippingMethod() ? quote.shippingMethod().carrier_code + '_' + quote.shippingMethod().method_code : null;
                        }
                    ),
                    getFormattedPrice: function (price) {
                        return priceUtils.formatPrice(price, quote.getPriceFormat());
                    },
                    getProductBySeller: function (seller_id) {
                        var list = [];
                        var items = quote.getItems();
                        $.each(items, function (index, value) {
                            if (list.indexOf(value.product.name) === -1 && value.product.seller_id == seller_id) {
                                list.push(value.product.name + ' x ' + value.qty);
                            }
                        });
                        return _.filter(
                            list, function (item) {
                                return true;
                            }
                        );
                    },
                    getSellerName: function (seller_id) {
                        var theRate = this.getRatesForGroup(seller_id)
                        if (theRate && theRate[0]) {
                            return theRate[0].carrier_title;
                        }
                    },
                    getRatesForGroup: function (shippingRateGroupTitle) {
                        return _.filter(
                            this.rates(), function (rate) {
                                if (typeof shippingRateGroupTitle != "undefined") {
                                    if (rate['seller_id'] == 'admin' && shippingRateGroupTitle == '0') {
                                        return true;
                                    }
                                    return shippingRateGroupTitle === rate['seller_id'];
                                }
                            }
                        );
                    },
                    selectShippingMethod: function (shippingMethod) {
                        selectShippingMethodAction(shippingMethod);
                        checkoutData.setSelectedShippingRate(shippingMethod.carrier_code + '_' + shippingMethod.method_code);
                        return true;
                    },

                    selectVirtualMethod: function (shippingMethod) {
                        var flagg = true;
                        var METHOD_SEPARATOR = ':';
                        var rates = [];
                        var flag = false;
                        var count = 0;
                        var price = 0;
                        var textPrice = $t('Total Shipping Cost: ')
                        $('.seller-rates').each(function () {
                            var $seller_rates = $(this);
                            var $radio = $seller_rates.find('.radio:checked');
                            if ($radio.is(':checked')) {
                                count++;
                                flag = true;
                                rates.push($radio.val());
                                price += Number($radio.attr('price'));
                            }
                        })
                        var total = price.toFixed(2);
                        var totalPrice = priceUtils.formatPrice(total, quote.getPriceFormat());
                        $("#total-price").html(textPrice + totalPrice);
                        window.selected = count;
                        if (!flag) {
                            flagg = false;
                        }
                        if (flagg) {
                            var rate = '';
                            for (var i = 0; i < rates.length; i++) {
                                if (i != rates.length) {
                                    rates[i] = rates[i].substring(13);
                                }
                                if (i == 0) {
                                    rate = rates[i];
                                } else {
                                    rate = rate + METHOD_SEPARATOR + rates[i];
                                }
                            }
                            if (count == window.sellerArray) {
                                var selectShippingMethod = shippingMethod;
                                selectShippingMethod.method_code = rate;
                                selectShippingMethod.method_title = window.checkoutConfig.sellermultishipping.method_title;
                                selectShippingMethod.carrier_title = window.checkoutConfig.sellermultishipping.carrier_title;
                                selectShippingMethod.amount = price;
                                selectShippingMethodAction(selectShippingMethod);
                                checkoutData.setSelectedShippingRate(rate);
                            }
                        }
                        return true;
                    },

                    setShippingInformation: function () {
                        if (this.validateShippingInformation()) {
                            setShippingInformationAction().done(
                                function () {
                                    stepNavigator.next();
                                }
                            );
                        }
                    },

                    validateShippingInformation: function () {
                        var shippingAddress,
                            addressData,
                            loginFormSelector = 'form[data-role=email-with-possible-login]',
                            emailValidationResult = customer.isLoggedIn();
                        if (!quote.shippingMethod() || window.sellerArray != window.selected) {
                            this.errorValidationMessage($t('Please specify a shipping method.'));
                            return false;
                        }
                        if (!customer.isLoggedIn()) {
                            $(loginFormSelector).validation();
                            emailValidationResult = Boolean($(loginFormSelector + ' input[name=username]').valid());
                        }

                        if (!emailValidationResult) {
                            $(loginFormSelector + ' input[name=username]').focus();
                        }

                        if (this.isFormInline) {
                            this.source.set('params.invalid', false);
                            this.source.trigger('shippingAddress.data.validate');
                            if (this.source.get('shippingAddress.custom_attributes')) {
                                this.source.trigger('shippingAddress.custom_attributes.data.validate');
                            }
                            ;
                            if (this.source.get('params.invalid')
                                || !quote.shippingMethod().method_code
                                || !quote.shippingMethod().carrier_code
                                || !emailValidationResult
                            ) {
                                return false;
                            }
                            shippingAddress = quote.shippingAddress();
                            addressData = addressConverter.formAddressDataToQuoteAddress(
                                this.source.get('shippingAddress')
                            );

                            //Copy form data to quote shipping address object
                            for (var field in addressData) {
                                if (addressData.hasOwnProperty(field)
                                    && shippingAddress.hasOwnProperty(field)
                                    && typeof addressData[field] != 'function'
                                ) {
                                    shippingAddress[field] = addressData[field];
                                }
                            }

                            if (customer.isLoggedIn()) {
                                shippingAddress.save_in_address_book = 1;
                            }
                            selectShippingAddress(shippingAddress);
                        }
                        return true;
                    }
                }
            );
        }
    }
);

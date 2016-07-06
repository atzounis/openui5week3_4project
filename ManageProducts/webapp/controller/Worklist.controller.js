sap.ui.define([
		"opensap/manageproducts/controller/BaseController",
		"sap/ui/model/json/JSONModel",
		"opensap/manageproducts/model/formatter",
		"sap/ui/model/Filter",
		"sap/ui/model/FilterOperator",
		"sap/ui/core/routing/History"
	], function (BaseController, JSONModel, formatter, Filter, FilterOperator, History) {
		"use strict";

		return BaseController.extend("opensap.manageproducts.controller.Worklist", {

			formatter: formatter,
			
			/* _mFilters - helper object for storing our filter objects 
			we use the same keys as we have set in the view (Cheap/Moderate/Expanesive*/
			
			_mFilters: {
				/* we define a new filter of view path 'Price', filter attribute LessThan 100
				  available numeric filters: BT, GE, GT, LE, LT*/
				cheap: [new Filter("Price", "LT", 100)],
				moderate: [new Filter("Price", "BT", 100, 1000)], //notice BT - between takes 2 arguments
				expensive: [new Filter("Price", "GT", 1000)]
			},

			/* =========================================================== */
			/* lifecycle methods                                           */
			/* =========================================================== */

			/**
			 * Called when the worklist controller is instantiated.
			 * @public
			 */
			onInit : function () {
				var oViewModel,
					iOriginalBusyDelay,
					oTable = this.byId("table");

				// Put down worklist table's original value for busy indicator delay,
				// so it can be restored later on. Busy handling on the table is
				// taken care of by the table itself.
				iOriginalBusyDelay = oTable.getBusyIndicatorDelay();
				this._oTable = oTable;
				// keeps the search state
				this._oTableSearchState = [];

				// Model used to manipulate control states
				oViewModel = new JSONModel({
					worklistTableTitle : this.getResourceBundle().getText("worklistTableTitle"),
					saveAsTileTitle: this.getResourceBundle().getText("worklistViewTitle"),
					shareOnJamTitle: this.getResourceBundle().getText("worklistViewTitle"),
					shareSendEmailSubject: this.getResourceBundle().getText("shareSendEmailWorklistSubject"),
					shareSendEmailMessage: this.getResourceBundle().getText("shareSendEmailWorklistMessage", [location.href]),
					tableNoDataText : this.getResourceBundle().getText("tableNoDataText"),
					tableBusyDelay : 0,
					//adding new properties (Cheap/Moderate/Expensive) and initialized to 0
					//the values will be updated onUpdateFinished method
					cheap:0,
					moderate:0,
					expensive:0
				});
				this.setModel(oViewModel, "worklistView");

				// Make sure, busy indication is showing immediately so there is no
				// break after the busy indication for loading the view's meta data is
				// ended (see promise 'oWhenMetadataIsLoaded' in AppController)
				oTable.attachEventOnce("updateFinished", function(){
					// Restore original busy indicator delay for worklist's table
					oViewModel.setProperty("/tableBusyDelay", iOriginalBusyDelay);
				});
			},

			/* =========================================================== */
			/* event handlers                                              */
			/* =========================================================== */

			/**
			 * Triggered by the table's 'updateFinished' event: after new table
			 * data is available, this handler method updates the table counter.
			 * This should only happen if the update was successful, which is
			 * why this handler is attached to 'updateFinished' and not to the
			 * table's list binding's 'dataReceived' method.
			 * @param {sap.ui.base.Event} oEvent the update finished event
			 * @public
			 */
			 
			/**
			 * Event handler when the add button gets pressed
			 * @public
			 */
			onAdd: function() {
				this.getRouter().navTo("add");
			},

			
			onUpdateFinished : function (oEvent) {
				// update the worklist's object counter after the table update
				var sTitle,
					oTable = oEvent.getSource(),
					iTotalItems = oEvent.getParameter("total"),
					
					// to show the availble numbers next to each filter icon,
					//first reference to the model
					oModel = this.getModel(),
					// then we fetch our veiwMorel insance (like a shortcut) 
					oViewModel = this.getModel("worklistView");
					
					
				// only update the counter if the length is final and
				// the table is not empty
				if (iTotalItems && oTable.getBinding("items").isLengthFinal()) {
					sTitle = this.getResourceBundle().getText("worklistTableTitleCount", [iTotalItems]);
					
					//we iterate on internal filter object and execute the filter action (receives the key and 
					// the filter object for each one of the filters - we trigger a callback function on each 
					//one of the filters
					jQuery.each(this._mFilters, function(sKey, oFilter) {
						/* manual read operation on model - we pass the path /ProductSet
						and a special oData parameter $count - will return the numOf items */
						oModel.read("/ProductSet/$count", { //by default $count would return all the itmes
							filters: oFilter,  //but we are interestied on the ones under the filter
							success: function (oData) {
								var sPath = "/" + sKey;
								oViewModel.setProperty(sPath, oData); //finally we set this number to the view model
							}
						});
					});
				} else {
					sTitle = this.getResourceBundle().getText("worklistTableTitle");
				}
				this.getModel("worklistView").setProperty("/worklistTableTitle", sTitle);
			},

			/**
			 * Event handler when a table item gets pressed
			 * @param {sap.ui.base.Event} oEvent the table selectionChange event
			 * @public
			 */
			onPress : function (oEvent) {
				// The source is the list item that got pressed
				this._showObject(oEvent.getSource());
			},


			/**
			 * Event handler for navigating back.
			 * We navigate back in the browser historz
			 * @public
			 */
			onNavBack : function() {
				history.go(-1);
			},


			onSearch : function (oEvent) {
				if (oEvent.getParameters().refreshButtonPressed) {
					// Search field's 'refresh' button has been pressed.
					// This is visible if you select any master list item.
					// In this case no new search is triggered, we only
					// refresh the list binding.
					this.onRefresh();
				} else {
					var oTableSearchState = [];
					var sQuery = oEvent.getParameter("query");

					if (sQuery && sQuery.length > 0) {
						oTableSearchState = [new Filter("ProductID", FilterOperator.Contains, sQuery)];
					}
					this._applySearch(oTableSearchState);
				}

			},

			/**
			 * Event handler for refresh event. Keeps filter, sort
			 * and group settings and refreshes the list binding.
			 * @public
			 */
			onRefresh : function () {
				this._oTable.getBinding("items").refresh();
			},
			
			/* we create an event-based function - select event onQuickFilter
			   this function will help with setting the filters on the table
			   standard parameter of the function - for all events: oEvent */
			onQuickFilter: function(oEvent) {
				
				var sKey = oEvent.getParameter("key"), //key is from the event parameter passing the key (Cheap/Moderate/Expensive)
					oFilter = this._mFilters[sKey], //filter object where i stored the helper object created earlier (_mFilters)
					oTable = this.byId("table"),
					oBinding = oTable.getBinding("items"); //table instace, binding of the table needs to change see oInite method
																//the binding is table's getBinding (items is the name of the aggregation)
					if(oFilter){
					oBinding.filter(oFilter);	// filters are applied on biding level (on the items) not on the table
					}else{
						oBinding.filter([]);
					}
			},
			/**
			 * Event handler for press event on object identifier. 
			 * opens detail popover to show product dimensions.
			 * since it is an event handler it takes an oEvent -  
			 * event object passed
			 */
			onShowDetailPopover : function (oEvent) {
				var oPopover = this._getPopover();
				// var oPopover = this.byId("dimensionsPopover");
				var oSource = oEvent.getSource();
				oPopover.bindElement(oSource.getBindingContext().getPath());
				// open dialog
				oPopover.openBy(oEvent.getParameter("domRef"));
			},

			/* =========================================================== */
			/* internal methods                                            */
			/* =========================================================== */

			/**
			 * Shows the selected item on the object page
			 * On phones a additional history entry is created
			 * @param {sap.m.ObjectListItem} oItem selected Item
			 * @private
			 */
			_showObject : function (oItem) {
				this.getRouter().navTo("object", {
					objectId: oItem.getBindingContext().getProperty("ProductID")
				});
			},
			_getPopover : function () {
			// create dialog lazily
				if (!this._oPopover) {
					// create popover via fragment factory
					this._oPopover = sap.ui.xmlfragment(
					"opensap.manageproducts.view.ResponsivePopover", this);
					this.getView().addDependent(this._oPopover);
				}
				return this._oPopover;
			},
			
						
			// onDelete: function(oEvent){
			// 	var m = oEvent.getSource().getParent();
			// 	  var tbl = this.getView().byId("TableID");
			// 	  var idx = m.getBindingContextPath();
			// 	  idx = idx.charAt(idx.lastIndexOf('/')+1);
			// 	  if (idx !== -1) {
			// 	  var a = tbl.getModel();                  // if named model - var a= tbl.getModel(ModelName);
			// 	  var data = a.getData();
			// 	  var removed = data.splice(idx,1);
			// 	// Check return value of data.              
			// 	// If data has an hierarchy. Ex: data.results                                                                    
			// 	// var removed =data.results.splice(idx,1);
			// 	  a.setData(data);
			// 	}
			// },
				/**
			 * Event handler when a filter tab gets pressed
			 * @param {sap.ui.base.Event} oEvent the filter tab event
			 * @public
			 */
			
			
			/**
			 * Internal helper method to apply both filter and search state together on the list binding
			 * @param {object} oTableSearchState an array of filters for the search
			 * @private
			 */
			_applySearch: function(oTableSearchState) {
				var oViewModel = this.getModel("worklistView");
				this._oTable.getBinding("items").filter(oTableSearchState, "Application");
				// changes the noDataText of the list in case there are no filter results
				if (oTableSearchState.length !== 0) {
					oViewModel.setProperty("/tableNoDataText", this.getResourceBundle().getText("worklistNoDataWithSearchText"));
				}
			}

		});
	}
);
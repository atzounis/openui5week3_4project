sap.ui.define(["sap/ui/core/Control",
				"sap/m/Button"
	], 
	
	function(Control, Button) {

		"use strict";


	return Control.extend("opensap.manageproducts.control.ProductDelete", {

			metadata : {
				properties : {},
				aggregations : {
					button : {type : "sap.m.Button"}
				},
				events : {
					productDelete : {
						parameters : {
							value : "ProductID"
						}
					}
	
				}
			},
	
			init : function() {
				
				this.getModel().deleteEntry(this._oContext);
				
			
			},
	
			renderer : function(oRm, oControl) {
				oRm.write("<div");
				oRm.writeControlData(oControl);
				oRm.addClass("sapUiSmallMarginBeginEnd");
				oRm.writeClasses();
				oRm.write(">");
	
				oRm.renderControl(oControl.getAggregation("_rating"));
				oRm.renderControl(oControl.getAggregation("_button"));
	
				oRm.write("</div>");
	
			}
		
	});
});

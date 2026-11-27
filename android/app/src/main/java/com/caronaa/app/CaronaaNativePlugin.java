package com.caronaa.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Read-only checks for the CARONAA web app. Exposes no token or personal data. */
@CapacitorPlugin(name = "CaronaaNative")
public class CaronaaNativePlugin extends Plugin {
    @PluginMethod
    public void firebaseStatus(PluginCall call) {
        // google_app_id is generated only when a real google-services.json is built in.
        int id = getContext().getResources().getIdentifier("google_app_id", "string", getContext().getPackageName());
        JSObject result = new JSObject();
        result.put("configured", id != 0);
        call.resolve(result);
    }
}

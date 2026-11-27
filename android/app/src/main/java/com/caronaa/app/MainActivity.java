package com.caronaa.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CaronaaNativePlugin.class);
        super.onCreate(savedInstanceState);
        RideAlertChannel.ensure(this);
    }
}

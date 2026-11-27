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

    // Reuse the existing BridgeActivity and WebView; no reload/loadUrl on resume.
    @Override public void onResume() {
        super.onResume();
        CaronaaLocationService.setUiForeground(true);
    }

    @Override public void onPause() {
        CaronaaLocationService.setUiForeground(false);
        super.onPause();
    }
}

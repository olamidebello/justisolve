package com.justisolve.mobile.preview;
import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.graphics.Bitmap;
import android.webkit.*;
import android.widget.*;
import android.view.View;
import android.Manifest;
import java.util.ArrayList;

/** HTTPS website client. No JavaScript bridge and no embedded server credentials. */
public class MainActivity extends Activity {
 private static final String HOME="https://justisolve.com/";
 private WebView web;private TextView status;private ValueCallback<Uri[]> files;private PermissionRequest microphone;
 private boolean internal(Uri uri){return "https".equals(uri.getScheme())&&("justisolve.com".equalsIgnoreCase(uri.getHost())||"www.justisolve.com".equalsIgnoreCase(uri.getHost()))&&(uri.getPort()==-1||uri.getPort()==443)&&uri.getUserInfo()==null;}
 private void external(Uri uri){String scheme=uri.getScheme();if(!("https".equals(scheme)||"mailto".equals(scheme)||"tel".equals(scheme)||"sms".equals(scheme))){status.setText("This link is not supported. Use Browser for the full website.");return;}try{startActivity(new Intent(Intent.ACTION_VIEW,uri).addCategory(Intent.CATEGORY_BROWSABLE));}catch(android.content.ActivityNotFoundException e){status.setText("No app can open this link.");}}
 @Override public void onCreate(Bundle state){super.onCreate(state);
  LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);layout.setBackgroundColor(0xff07101f);
  int pad=(int)(8*getResources().getDisplayMetrics().density);layout.setPadding(0,pad,0,pad);
  layout.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
  LinearLayout bar=new LinearLayout(this);for(String title:new String[]{"Home","Reload","Browser"}){Button b=new Button(this);b.setText(title);b.setOnClickListener(v->{if(title.equals("Home"))web.loadUrl(HOME);else if(title.equals("Reload"))web.reload();else external(Uri.parse(internal(Uri.parse(web.getUrl()==null?HOME:web.getUrl()))?web.getUrl()==null?HOME:web.getUrl():HOME));});bar.addView(b,new LinearLayout.LayoutParams(0,-2,1));}layout.addView(bar);
  status=new TextView(this);status.setTextColor(0xffeef3ff);status.setPadding(pad,pad,pad,pad);status.setText("JustiSolve preview · Internet required");layout.addView(status);
  web=new WebView(this);layout.addView(web,new LinearLayout.LayoutParams(-1,0,1));setContentView(layout);
  WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setGeolocationEnabled(false);settings.setMediaPlaybackRequiresUserGesture(true);settings.setSupportMultipleWindows(false);
  CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);WebView.setWebContentsDebuggingEnabled(false);
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest request){Uri url=request.getUrl();if(internal(url)&&!url.getPath().endsWith(".apk"))return false;if(request.isForMainFrame())external(url);return true;}
   @Override public void onPageStarted(WebView v,String url,Bitmap icon){if(!internal(Uri.parse(url))){v.stopLoading();status.setText("Navigation blocked. Use Browser for external pages.");return;}status.setText("Loading JustiSolve…");}
   @Override public void onPageFinished(WebView v,String url){CookieManager.getInstance().flush();status.setText("JustiSolve preview · "+(internal(Uri.parse(url))?Uri.parse(url).getHost():"External page blocked"));}
   @Override public void onReceivedError(WebView v,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())status.setText("Connection failed. Check internet and tap Reload.");}
   @Override public void onReceivedSslError(WebView v,SslErrorHandler handler,android.net.http.SslError error){handler.cancel();status.setText("Secure connection failed. The website certificate must be repaired.");}
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params){if(files!=null)files.onReceiveValue(null);files=callback;if(!internal(Uri.parse(v.getUrl()==null?"":v.getUrl()))){files.onReceiveValue(null);files=null;return true;}Intent chooser=new Intent(Intent.ACTION_OPEN_DOCUMENT);chooser.addCategory(Intent.CATEGORY_OPENABLE);chooser.setType("*/*");chooser.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);try{startActivityForResult(chooser,7);}catch(android.content.ActivityNotFoundException e){files.onReceiveValue(null);files=null;status.setText("No file picker available. Use Browser.");}return true;}
   @Override public void onPermissionRequest(PermissionRequest request){runOnUiThread(()->{if(!internal(request.getOrigin())||!hasWindowFocus()){request.deny();return;}boolean audio=false;for(String resource:request.getResources())if(resource.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE))audio=true;if(!audio){request.deny();status.setText("Camera and video capture require Browser.");return;}if(microphone!=null)microphone.deny();microphone=request;if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)grantMicrophone();else requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},8);});}
   @Override public void onPermissionRequestCanceled(PermissionRequest request){if(microphone==request)microphone=null;}
  });
  web.setDownloadListener((url,ua,disposition,mime,size)->{status.setText("Downloads open in your browser; sign in there if required.");external(Uri.parse(url));});
  if(state==null||web.restoreState(state)==null)web.loadUrl(HOME);
 }
 private void grantMicrophone(){PermissionRequest request=microphone;microphone=null;if(request==null)return;if(internal(request.getOrigin())&&internal(Uri.parse(web.getUrl()==null?"":web.getUrl()))&&hasWindowFocus()&&checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});else request.deny();}
 @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(request==8)grantMicrophone();}
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==7&&files!=null){Uri[] selected=null;if(result==RESULT_OK&&data!=null){if(data.getClipData()!=null){ArrayList<Uri> chosen=new ArrayList<>();for(int i=0;i<data.getClipData().getItemCount();i++){Uri uri=data.getClipData().getItemAt(i).getUri();if("content".equals(uri.getScheme()))chosen.add(uri);}selected=chosen.toArray(new Uri[0]);}else if(data.getData()!=null&&"content".equals(data.getData().getScheme()))selected=new Uri[]{data.getData()};}files.onReceiveValue(selected);files=null;}}
 @Override protected void onSaveInstanceState(Bundle state){web.saveState(state);super.onSaveInstanceState(state);}
 @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
 @Override protected void onDestroy(){if(files!=null)files.onReceiveValue(null);if(microphone!=null)microphone.deny();web.stopLoading();web.destroy();super.onDestroy();}
}

package com.fouremp.app;

import android.content.Context;
import android.graphics.*;
import android.view.View;

/** A clockwise, clamped progress arc; elapsed time can continue beyond a full ring. */
final class ProgressRing extends View {
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
    private float progress;
    ProgressRing(Context context) { super(context); setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO); }
    void progress(double value) { progress=(float)value; invalidate(); }
    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float stroke=10*getResources().getDisplayMetrics().density;
        float radius=Math.min(getWidth(),getHeight())/2f-stroke;
        float x=getWidth()/2f,y=getHeight()/2f;
        RectF bounds=new RectF(x-radius,y-radius,x+radius,y+radius);
        paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(stroke); paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setShader(null); paint.setColor(0xFF293744); canvas.drawOval(bounds,paint);
        paint.setShader(new SweepGradient(x,y,new int[]{0xFFBEF264,0xFF67E8F9,0xFFBEF264},null));
        canvas.drawArc(bounds,-90,360*progress,false,paint);
    }
}

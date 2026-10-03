from pathlib import Path
from html import escape
from math import cos,sin,pi
from colorsys import hls_to_rgb

out=Path(__file__).resolve().parents[1]/'assets'
out.mkdir(exist_ok=True)
ink='#25342f'; muted='#69796e'; green='#087f6b'; warm='#d88248'
def txt(x,y,s,size=24,color=ink,anchor='start'):
 return f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" text-anchor="{anchor}">{escape(s)}</text>'
def box(x,y,w,h,fill,stroke='none',rx=6):
 return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'
def line(x1,y1,x2,y2,color=ink,width=3,dash=''):
 return f'<path d="M{x1} {y1}L{x2} {y2}" fill="none" stroke="{color}" stroke-width="{width}" stroke-dasharray="{dash}"/>'
def dot(x,y,r,fill,stroke='none'):
 return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="3"/>'
def rgb(h,l=.55,s=.7):
 return '#'+''.join(f'{round(v*255):02x}' for v in hls_to_rgb(h/360,l,s))
def point(cx,cy,r,deg):
 return (cx+r*cos(deg*pi/180),cy+r*sin(deg*pi/180))
def wheel(cx,cy,r=130,selected=()):
 b=''
 for i in range(12):
  a=i*30-105; z=a+30
  p=[point(cx,cy,rr,angle) for rr,angle in [(r,a),(r,z),(r*.59,z),(r*.59,a)]]
  b+=f'<path d="M{p[0][0]} {p[0][1]}A{r} {r} 0 0 1 {p[1][0]} {p[1][1]}L{p[2][0]} {p[2][1]}A{r*.59} {r*.59} 0 0 0 {p[3][0]} {p[3][1]}Z" fill="{rgb(i*30)}" stroke="#eeeade" stroke-width="2"/>'
 for i in selected:
  x,y=point(cx,cy,r*.8,i*30-90)
  b+=line(cx,cy,x,y,ink,3)+dot(x,y,10,'#faf8ed',ink)
 return b
def save(name,title,subtitle,body):
 svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="960" height="680" viewBox="0 0 960 680"><defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#bdc9bf" stroke-width=".6"/></pattern></defs><rect width="960" height="680" fill="#eeeede"/><rect x="24" y="24" width="912" height="632" fill="url(#grid)"/><g font-family="Microsoft YaHei,Noto Sans CJK SC,sans-serif">{txt(48,64,'MCLARY / COLOR STUDIES',16,muted)}{txt(48,116,title,36)}{txt(48,156,subtitle,19,muted)}{body}{line(48,618,912,618,muted,1)}{txt(48,649,'学习示意 · 实际观感受设备、背景与观看环境影响',15,muted)}{txt(912,649,'COLOR / FIELD NOTES',15,muted,'end')}</g></svg>'''
 (out/f'{name}.svg').write_text(svg,encoding='utf-8')

def bands():
 b=''
 for row,(label,colors) in enumerate([('色相',[rgb(i*30) for i in range(12)]),('明暗',[rgb(164,.16+i*.06,.5) for i in range(12)]),('鲜灰',[rgb(164,.46,i/12) for i in range(12)])]):
  y=228+row*116;b+=txt(62,y+37,label,24)
  for i,c in enumerate(colors):b+=box(160+i*61,y,59,64,c,rx=2)
 return b
save('color-intro','把颜色拆成三个观察维度','颜色是什么、明暗如何、鲜艳到什么程度。',bands())
save('color-dimensions','一次只改变一个方向','色带分别展示色相、明暗与鲜灰变化，并非感知等距量表。',bands()+txt(480,589,'相同 HSL 明度数值 ≠ 相同的视觉亮度',22,green,'middle'))

b=''
for i,(bg,fg,label) in enumerate([('#b7c7b3','#9eaf98','明暗接近'),('#e6eadc','#293f39','明暗分开')]):
 x=60+i*440;b+=box(x,218,400,260,bg)+dot(x+200,345,73,fg)+txt(x+200,526,label,24,ink,'middle')
for i,c in enumerate(['#ececdf','#a3aca0','#2a3d36']):b+=box(304+i*119,554,111,39,c)
save('color-values','先区分明暗，再添加色相','相同的图形，改变明度差，边界清晰度也会改变。',b)

b=box(58,204,402,365,'#20332f')+txt(259,251,'RGB / 屏幕光',27,'#f2f1e8','middle')
for i,(c,label) in enumerate([('#ee5758','R'),('#44c68c','G'),('#597ee5','B')]):b+=box(95+i*112,292,101,152,c)+txt(145+i*112,486,label,26,'#fff','middle')
b+=txt(259,542,'组合不同强度的光',20,'#f2f1e8','middle')+box(500,204,402,365,'#faf8ed',muted)+txt(701,251,'CMYK / 印刷油墨',27,ink,'middle')
for i,(c,label) in enumerate([('#41bfc4','C'),('#d45594','M'),('#eadb46','Y'),('#202725','K')]):b+=box(526+i*87,292,76,152,c)+txt(564+i*87,486,label,26,ink,'middle')
b+=txt(701,542,'纸张与油墨影响反射光',20,ink,'middle')
save('color-models','输出方式不同，颜色范围也不同','模式转换需要目标条件；重要印刷作品还需要实际打样。',b)

b=wheel(296,375,154,(5,6,7))+wheel(686,375,154,(0,6))+txt(296,574,'相邻色相',25,ink,'middle')+txt(686,574,'相对色相',25,ink,'middle')
save('color-relations-intro','从色轮看见颜色之间的关系','示意使用 RGB 色相环；实际搭配还要考虑面积与明暗。',b)
save('color-harmony','类似色与互补关系','同一张色轮上，相邻与相对提供两种不同的组织方式。',b)

b=''
for x,colors,label in [(60,['#9db9c7','#3c758c','#354958'],'偏冷的邻色'),(500,['#d9aa77','#c5774a','#8a5843'],'偏暖的邻色')]:
 for i,c in enumerate(colors):b+=box(x+i*133,224,133,289,c,rx=0)
 b+=box(x+135,318,130,100,'#8b9c7d','#eeeadd',0)+txt(x+200,559,label,24,ink,'middle')
save('color-temperature','冷暖，要放在关系中比较','两个中心绿色都为 #8B9C7D；这里说的是视觉冷暖。',b)

b=box(62,223,400,308,'#e1e4d9')+box(498,223,400,308,'#28332f')
for x in [202,638]:b+=box(x,307,120,120,'#8c8c8c',rx=0)
b+=txt(480,578,'两个中心方块完全相同：#8C8C8C',24,green,'middle')
save('color-context','相同颜色，不同背景','先凭眼睛比较，再核对色值。',b)

def poster(x,y,w,h):
 b=box(x,y,w,h,'#e3dfcc',ink,3)+box(x+20,y+20,w-40,52,'#2d554b')
 b+=txt(x+38,y+55,'COLOR NOTES',19,'#f3efe1')
 for k in range(3):b+=box(x+24,y+91+k*24,w-90-(k%2)*25,7,'#536b5f')
 b+=box(x+24,y+h-65,113,38,'#c57148')+txt(x+80,y+h-40,'了解更多',16,'#fff','middle')
 return b
b=poster(76,221,380,345)
for i,(c,label) in enumerate([('#e3dfcc','背景'),('#2d554b','信息'),('#c57148','强调')]):b+=box(548,236+i*113,110,80,c)+txt(692,283+i*113,label,26,ink)
save('color-palette-intro','让每一种颜色都有工作','从一排色卡，到实际的内容层级。',b)

b=box(70,221,504,309,'#d9d9b8',ink,2)
b+='<path d="M70 422L226 283L345 395L446 301L574 397V530H70Z" fill="#819785"/><path d="M70 493Q333 341 574 460V530H70Z" fill="#31594d"/>'
b+=dot(480,285,29,'#c77d4e')
for i,(c,label) in enumerate([('#d9d9b8','大面积基调'),('#31594d','深色结构'),('#c77d4e','细节强调')]):b+=box(633,222+i*108,76,76,c)+txt(736,269+i*108,label,20)
b+=txt(480,578,'取样以后，还要为新的用途调整明暗与鲜灰。',22,ink,'middle')
save('color-extract','从参考中提取关系','这幅简化风景用三个颜色，示范观察与精简。',b)

b=''
colors=['#e3dfcc','#2d554b','#c57148']
for row,order in enumerate([colors,colors[::-1]]):
 y=235+row*165;start=68
 for c,w,label in zip(order,[494,247,83],['60%','30%','10%']):
  b+=box(start,y,w,110,c,'#f8f4e8',0)+txt(start+w/2,y+144,label,23,ink,'middle');start+=w
b+=txt(480,603,'交换面积，气氛与视觉重心就会改变。',21,green,'middle')
save('color-roles','颜色相同，角色可以不同','60 / 30 / 10 是试配起点，不是固定公式。',b)

b=poster(67,210,360,362)
checks=[('01','正文与背景是否容易分辨？'),('02','重要信息是否只有一个重点？'),('03','去掉颜色后，含义还清楚吗？'),('04','同类元素是否使用一致颜色？')]
for i,(num,label) in enumerate(checks):
 y=258+i*90;b+=dot(493,y-7,19,green)+txt(493,y,num,15,'#fff','middle')+txt(527,y,label,21)
save('color-check','用实际内容检验配色','比较文字、图片与状态，不只比较大色块。',b)
print('Created 12 original color-learning diagrams.')

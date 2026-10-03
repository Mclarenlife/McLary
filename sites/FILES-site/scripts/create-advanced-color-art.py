from pathlib import Path
import runpy

art=runpy.run_path(str(Path(__file__).with_name('create-color-art.py')))
txt,box,line,dot,wheel,save=[art[k] for k in ['txt','box','line','dot','wheel','save']]
ink=art['ink']; green=art['green']; muted=art['muted']

def pair(x,y,a,b,label):
 return box(x,y,192,155,a,rx=0)+box(x+192,y,192,155,b,rx=0)+txt(x+192,y+193,label,22,ink,'middle')
b=pair(66,230,'#3059ab','#d48641','色相差异')+pair(510,230,'#d9e3f6','#243e6e','明暗差异')+txt(480,545,'对比是多维的；互补关系需要先说明色轮。',24,green,'middle')
save('color-contrast-intro','让差异服务于表达','色相、明暗、鲜灰、面积，都能组织视觉层级。',b)
b=''
for x,y,a,c,label in [(62,206,'#3564b6','#d58148','色相'),(504,206,'#dce6f5','#243f76','明暗'),(62,412,'#bbb5ae','#e89427','鲜灰'),(504,412,'#315994','#c8784c','面积')]:
 w=384 if label!='面积' else 640
 b+=box(x,y,300 if label=='面积' else 192,128,a,rx=0)+box(x+(300 if label=='面积' else 192),y,84 if label=='面积' else 192,128,c,rx=0)+txt(x+192,y+163,label,22,ink,'middle')
save('color-contrast-dimensions','先辨认哪一种差异在起作用','一次只调整一个维度，更容易判断修改是否有效。',b)

b=wheel(258,381,148,(0,6))+txt(258,579,'RGB：红 ↔ 青',24,ink,'middle')
for i,(a,c,label) in enumerate([('#d94541','#398456','红 ↔ 绿'),('#3563ae','#de8c34','蓝 ↔ 橙'),('#e6ce4d','#825b9e','黄 ↔ 紫')]):
 y=232+i*106;b+=box(502,y,81,73,a)+box(592,y,81,73,c)+txt(704,y+46,label,23)
b+=txt(697,579,'RYB：传统配色起点',24,ink,'middle')
save('color-complements-models','不要把两张色轮当成同一张','RGB 与传统 RYB 的互补组合；色卡不代表真实混色结果。',b)

b=wheel(300,380,171,(7,0,2))
for i,(c,label) in enumerate([('#4387cc','主色 210°'),('#d64141','辅助 0°'),('#dddd44','辅助 60°')]):
 b+=box(573,240+i*99,99,66,c)+txt(704,281+i*99,label,22)
b+=txt(480,591,'210° 的对侧为 30°，再取其两侧 0° 与 60°。',21,green,'middle')
save('color-split-complement','分裂互补：对侧两邻色','示例角度来自 RGB 色相环，偏移量可以继续调整。',b)

b=''
for row,(widths,colors,label) in enumerate([([388,388],['#267ca5','#d58447'],'均匀面积'),([660,116],['#267ca5','#d58447'],'主色占多数'),([328,120,328],['#267ca5','#ddd9ca','#d58447'],'中性色间隔')]):
 x=92;y=221+row*121
 for w,c in zip(widths,colors):b+=box(x,y,w,72,c,rx=0);x+=w
 b+=txt(480,y+101,label,21,ink,'middle')
save('color-contrast-balance','让最强的差异出现在重点上','颜色数值不变，只改变面积与边界关系。',b)

back=[36,111,143];source=[239,152,77]
def blend(mode):
 vals=[]
 for b,s in zip(back,source):
  B,S=b/255,s/255
  r=S if mode=='normal' else B*S if mode=='multiply' else 1-(1-B)*(1-S) if mode=='screen' else 2*B*S if B<=.5 else 1-2*(1-B)*(1-S)
  vals.append(int(r*255+.5))
 return '#'+''.join(f'{v:02x}' for v in vals)
modeNames=[('normal','正常'),('multiply','正片叠底'),('screen','滤色'),('overlay','叠加')]
b=''
for i,(mode,label) in enumerate(modeNames):
 x=66+i*216;b+=box(x,254,192,233,blend(mode))+txt(x+96,534,label,24,ink,'middle')+txt(x+96,570,blend(mode).upper(),19,muted,'middle')
save('color-blending-intro','相同颜色，不同运算','底层 #246F8F，上层 #EF984D，不透明度 100%，sRGB 编码通道。',b)

b=box(61,220,402,348,'#17231f')+box(497,220,402,348,'#f6f5e9',ink)
b+=txt(262,269,'光的加色',29,'#fff','middle')+txt(698,269,'理想减色模型',29,ink,'middle')
for x,c in [(94,'#ff0000'),(212,'#00ff00'),(330,'#ffff00')]:b+=box(x,319,98,103,c)
for x,c in [(530,'#00ffff'),(648,'#ffff00'),(766,'#00ff00')]:b+=box(x,319,98,103,c)
b+=txt(262,467,'红 + 绿 → 黄',25,'#fff','middle')+txt(698,467,'青 + 黄 → 绿',25,ink,'middle')+txt(262,526,'不同原色光叠加',19,'#fff','middle')+txt(698,526,'选择性吸收的简化示意',19,ink,'middle')
save('color-additive-subtractive','先确定混合发生在哪种介质中','右图不预测具体颜料配方；实际材料还涉及光谱与散射。',b)

b=box(76,229,373,259,'#808080')+box(511,229,373,259,'#bcbcbc')
b+=txt(263,536,'编码数值平均：#808080',22,ink,'middle')+txt(697,536,'线性光平均：约 #BCBCBC',22,ink,'middle')+txt(480,586,'黑白各占 50%；“一半”取决于计算空间。',23,green,'middle')
save('color-alpha-space','相同权重，不同的运算空间','左：直接平均 sRGB 编码值；右：线性光平均后编码回 sRGB。',b)

b=''
for i,(mode,label) in enumerate(modeNames):
 y=209+i*95;b+=txt(69,y+39,label,23)+box(249,y,137,65,'#246f8f')+txt(419,y+40,'+',26,ink,'middle')+box(452,y,137,65,'#ef984d')+txt(622,y+40,'→',27,ink,'middle')+box(655,y,155,65,blend(mode))+txt(833,y+39,blend(mode).upper(),17)
save('color-blend-modes','混合函数改变重叠区域的颜色','按 sRGB 编码通道，100% 上层不透明度。',b)

b=''
for i,(name,color,detail) in enumerate([('先定目标','#315e60','压暗 / 提亮 / 对比'),('再选运算','#6d5bb6','模式 / 顺序 / 透明度'),('最后复核','#a45055','颜色空间 / 输出条件')]):
 x=60+i*300;b+=box(x,236,260,251,color)+txt(x+130,296,f'0{i+1}',29,'#fff','middle')+txt(x+130,361,name,29,'#fff','middle')+txt(x+130,418,detail,17,'#fff','middle')
b+=txt(480,561,'记录条件，才能重现结果；RGB 算法不等于颜料配方。',22,green,'middle')
save('color-blend-workflow','从随机试模式，到有目的地选择','每次只改一个变量，保留修改前后的对照。',b)
print('Created 10 advanced color diagrams.')

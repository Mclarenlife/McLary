$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$assetRoot = Join-Path $PSScriptRoot '..\assets'
New-Item -ItemType Directory -Path $assetRoot -Force | Out-Null
$base = 'https://a.storyblok.com/f/290489675855311/'
$assets = @{
 'frank-lloyd-wright-portrait' = '2670x3051/55cb173504/frank-lloyd-wright.avif'
 'frank-lloyd-wright-0' = '1569x1206/d63813ef39/frank-lloyd-wright-07.avif'
 'frank-lloyd-wright-1' = '1578x903/33e29819e8/frank-lloyd-wright-04.avif'
 'frank-lloyd-wright-2' = '1050x774/1a04b8960b/frank-lloyd-wright-08.avif'
 'irving-gill-portrait' = '2670x3051/2e1559825e/irving-gill.avif'
 'irving-gill-0' = '1422x1029/b75879663c/irving-gill-05.avif'
 'irving-gill-1' = '1458x1137/126ef11bb1/irving-gill-08.avif'
 'irving-gill-2' = '936x1173/d3590b3ca7/irving-gill-13.avif'
 'frank-gehry-portrait' = '2670x3051/fe5585eaf8/frank-gehry.avif'
 'frank-gehry-0' = '2124x1428/4a8d3127e0/frank-gehry-07.avif'
 'frank-gehry-1' = '1564x1180/301128a216/frank-gehry-04.avif'
 'frank-gehry-2' = '1753x962/d36d592b9d/frank-gehry-05.avif'
 'louis-kahn-portrait' = '2670x3051/39bc9c7e86/louis-kahn.avif'
 'louis-kahn-0' = '2061x1176/1a692072be/louis-kahn-12.avif'
 'louis-kahn-1' = '1366x922/4629687647/louis-kahn-06.avif'
 'louis-kahn-2' = '1532x1142/835e79976a/louis-kahn-02.avif'
 'i-m-pei-portrait' = '2670x3051/ca61586c14/i-m-pei.avif'
 'i-m-pei-0' = '1672x1605/22c2686b21/i-m-pei-05.avif'
 'i-m-pei-1' = '2122x1572/9aa9e80ac9/i-m-pei-08.avif'
 'i-m-pei-2' = '1651x1178/ab0ed1c65b/i-m-pei-10.avif'
 'paul-rudolph-portrait' = '2670x3051/5c62151b9e/paul-rudolph.avif'
 'paul-rudolph-0' = '1058x1552/837d5acc40/paul-rudolph-04.avif'
 'paul-rudolph-1' = '1251x1835/b5c09037a3/paul-rudolph-06.avif'
 'paul-rudolph-2' = '996x1299/c95a70e49c/paul-rudolph-13.avif'
 'mary-colter-portrait' = '2670x3051/0cfbd2668c/mary-colter.avif'
 'mary-colter-0' = '1633x1154/b30761070a/mary-colter-04.avif'
 'mary-colter-1' = '1034x1468/ae69da17a0/mary-colter-11.avif'
 'mary-colter-2' = '1365x921/eb2a75e00f/mary-colter-06.avif'
 'louis-sullivan-portrait' = '2670x3051/92172e41d8/louis-sullivan.avif'
 'louis-sullivan-0' = '1562x2130/b783d67585/louis-sullivan-08.avif'
 'louis-sullivan-1' = '1440x1986/9512fa6b2d/louis-sullivan-05.avif'
 'louis-sullivan-2' = '1212x909/ef64f6bc07/louis-sullivan-02.avif'
}
foreach ($entry in $assets.GetEnumerator()) {
 $destination = Join-Path $assetRoot ($entry.Key + '.avif')
 if (!(Test-Path -LiteralPath $destination)) {
  Invoke-WebRequest -Uri ($base + $entry.Value) -OutFile $destination
 }
 Write-Output $entry.Key
}
$fontCss = (Invoke-WebRequest -Uri 'https://fonts.googleapis.com/css2?family=Anton&display=swap' -UserAgent 'Mozilla/5.0').Content
$fontUrl = [regex]::Matches($fontCss, 'url\((https://[^)]+)\)') | Select-Object -Last 1
Invoke-WebRequest -Uri $fontUrl.Groups[1].Value -OutFile (Join-Path $assetRoot 'anton.ttf')
Write-Output 'Font downloaded'
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/google/fonts/main/ofl/anton/OFL.txt' -OutFile (Join-Path $assetRoot 'Anton-OFL.txt')

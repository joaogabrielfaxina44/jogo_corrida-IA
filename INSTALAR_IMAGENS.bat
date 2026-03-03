@echo off
set "brain=C:\Users\26012475\.gemini\antigravity\brain\3ef5595e-ad04-4805-8097-4f32adcb377a"
set "assets=C:\Users\26012475\Documents\GitHub\jogo_corrida-IA\assets"

echo Instalando imagens do Turbo Sprint...

if not exist "%assets%" mkdir "%assets%"

copy /y "%brain%\player_supercar_v2_1772561026476.png" "%assets%\car_player.png"
copy /y "%brain%\enemy_car_v2_1772561042583.png" "%assets%\car_enemy.png"
copy /y "%brain%\item_box_1772551811272.png" "%assets%\item_box.png"
copy /y "%brain%\oil_spill_asset_1772560400439.png" "%assets%\oil.png"

echo.
echo Concluido! Agora os carros estao na pasta assets.
pause

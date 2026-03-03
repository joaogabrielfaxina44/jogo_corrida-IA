@echo off
:: Script para mover imagens da pasta de geracao para a pasta do jogo
set "folder=C:\Users\26012475\.gemini\antigravity\brain\3ef5595e-ad04-4805-8097-4f32adcb377a"
set "dest=C:\Users\26012475\Documents\GitHub\jogo_corrida-IA\assets"

echo Copiando carros e itens para a pasta do jogo...

if not exist "%dest%" mkdir "%dest%"

copy /y "%folder%\player_supercar_v2_1772561026476.png" "%dest%\car_player.png"
copy /y "%folder%\enemy_car_v2_1772561042583.png" "%dest%\car_enemy.png"
copy /y "%folder%\item_box_1772551811272.png" "%dest%\item_box.png"
copy /y "%folder%\oil_spill_asset_1772560400439.png" "%dest%\oil.png"

echo.
echo PRONTO! As imagens agora estao em: %dest%
echo AGORA VOCE PRECISA:
echo 1. Abrir o GitHub Desktop
echo 2. Fazer o COMMIT das imagens
echo 3. Fazer o PUSH para o site atualizar.
echo.
pause

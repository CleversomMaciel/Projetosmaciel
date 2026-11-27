#!/bin/bash
# Monta um Reels (MP4 1080x1920) a partir das cenas cena-N.jpg de uma pasta de post.
# Uso: bash reel.sh posts/<pasta> [segundos_por_cena] [musica.mp3]
set -e
D=$1; T=${2:-4}; M=$3; F=0.6
N=$(ls $D/cena-*.jpg | wc -l)
args=(); filt=""
for i in $(seq 1 $N); do
  args+=(-loop 1 -t $T -i $D/cena-$i.jpg)
  filt+="[$((i-1)):v]scale=1188:2112,zoompan=z='min(zoom+0.0009,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=$((T*30)):s=1080x1920:fps=30,setsar=1[v$i];"
done
prev="v1"; off=$(echo "$T-$F" | bc)
for i in $(seq 2 $N); do
  filt+="[$prev][v$i]xfade=transition=fade:duration=$F:offset=$off[x$i];"; prev="x$i"; off=$(echo "$off+$T-$F" | bc)
done
filt=${filt%;}
if [ -n "$M" ]; then
  ffmpeg -y -loglevel error "${args[@]}" -i "$M" -filter_complex "$filt" -map "[$prev]" -map $N:a -shortest -c:v libx264 -pix_fmt yuv420p -r 30 -c:a aac -b:a 160k $D/reel.mp4
else
  ffmpeg -y -loglevel error "${args[@]}" -f lavfi -i anullsrc=r=44100:cl=stereo -filter_complex "$filt" -map "[$prev]" -map $N:a -shortest -c:v libx264 -pix_fmt yuv420p -r 30 -c:a aac $D/reel.mp4
fi
echo "ok $D/reel.mp4"

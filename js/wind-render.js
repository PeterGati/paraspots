function renderWindDirections(svg, directions) {

    const allDirs = ["N","NO","O","SO","S","SW","W","NW"];

    const radius = 120;
    const center = 150;

    svg.innerHTML = "";

    allDirs.forEach((dir, i) => {

        const angle = (i * 45 - 90) * Math.PI / 180;

        const x = center + Math.cos(angle) * radius;
        const y = center + Math.sin(angle) * radius;

        const circle = document.createElementNS("http://www.w3.org/2000/svg","circle");

        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        circle.setAttribute("r", directions.includes(dir) ? 12 : 6);

        circle.setAttribute("fill", directions.includes(dir) ? "#2ecc71" : "#ccc");

        svg.appendChild(circle);

        const label = document.createElementNS("http://www.w3.org/2000/svg","text");

        label.setAttribute("x", center + Math.cos(angle) * (radius + 25));
        label.setAttribute("y", center + Math.sin(angle) * (radius + 25));
        label.setAttribute("text-anchor","middle");
        label.setAttribute("dominant-baseline","middle");

        label.textContent = dir;

        svg.appendChild(label);

    });

}
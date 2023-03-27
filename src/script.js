const knowledgesCarouselActive = () => {
    let knowledgesCarousel = document.getElementById(`knowledges-carousel`)
    let children = knowledgesCarousel.children

    let actualPosition = -1;
    let direction = true;
    
    setInterval(() => { 

        actualPosition = (direction) ? actualPosition + 1 : actualPosition - 1;
        
        knowledgesCarousel.style.transform = `translateX(calc((150px + 20px) * -${actualPosition}))`;

        if (actualPosition >= children.length - 1) {
            direction = false;
        }

        else if (actualPosition <= 0) {
            direction = true;
        }

    }, 1000 * 3)
    
}

knowledgesCarouselActive();
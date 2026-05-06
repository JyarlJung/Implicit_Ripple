## Implicit Hugo Elias Ripple

<img width="400" height="401" alt="Animation2" src="https://github.com/user-attachments/assets/fc580b9c-3a96-43bf-9aa0-a896071f2441" />

A WebGL simulation of 2D water ripples using an **Implicit Simulation** applied to the Hugo Elias wave equation.
Hugo Elias ripple is pretty cheap to use in real-time rendering, but it is limited to spreading 1 pixel per frame unconditionally.
For example, if it's used in a game, you'll see a different wave speed at 30fps and 60fps.
We can implement dt-agnostic water riples by changing this to implicit method.

## How It Works: Solve Ripple
This method begins by assuming that the Hugo Elias equation is based on wave equation.

$$
\frac{\partial^2 u}{\partial t^2} = c^2 \left(\frac{\partial^2 u}{\partial x^2}+\frac{\partial^2 u}{\partial y^2}\right)
$$

The left and right sides are expressed using the finite difference method, respectively, as follows.

$$
\frac{u_{i,j}^{t+1} + u_{i,j}^{t-1} - 2u_{i,j}^t}{\Delta t^2} = c^2 \frac{u_{i+1,j}^t + u_{i-1,j}^t + u_{i,j+1}^t + u_{i,j-1}^t - 4u_{i,j}^t}{\Delta x^2}
$$

$$
u_{i,j}^{t+1} + u_{i,j}^{t-1} - 2u_{i,j}^t = \frac{c^2 \Delta t^2}{\Delta x^2}(u_{i+1,j}^t + u_{i-1,j}^t + u_{i,j+1}^t + u_{i,j-1}^t - 4u_{i,j}^t)
$$

Let's

$$
\frac{c^2 \Delta t^2}{\Delta x^2} = 0.5
$$

then

$$
u_{i,j}^{t+1} + u_{i,j}^{t-1} - 2u_{i,j}^t = \frac{u_{i+1,j}^t + u_{i-1,j}^t + u_{i,j+1}^t + u_{i,j-1}^t - 4u_{i,j}^t}{2}
$$

$$
u_{i,j}^{t+1} = \frac{u_{i+1,j}^t + u_{i-1,j}^t + u_{i,j+1}^t + u_{i,j-1}^t}{2} - u_{i,j}^{t-1}
$$

The equation that we know comes out.
On the other hand, let's

$$
c^2 = 1, \Delta x^2 = 1
$$

then

$$
u_{i,j}^{t+1} + u_{i,j}^{t-1} - 2u_{i,j}^t = \Delta t^2(u_{i+1,j}^t + u_{i-1,j}^t + u_{i,j+1}^t + u_{i,j-1}^t - 4u_{i,j}^t)
$$

$$
u_{i,j}^{t+1} = \Delta t^2(u_{i+1,j}^t + u_{i-1,j}^t + u_{i,j+1}^t + u_{i,j-1}^t - 4u_{i,j}^t) - u_{i,j}^{t-1} + 2u_{i,j}^t
$$

We can get the above equation, which looks similar to explicit 2D fluid equation. and we can use the implicit techniques in this.

$$
u_{i,j}^{t+1} -\Delta t^2(u_{i+1,j}^{t+1} + u_{i-1,j}^{t+1} + u_{i,j+1}^{t+1} + u_{i,j-1}^{t+1} - 4u_{i,j}^{t+1}) + u_{i,j}^{t-1} = 2u_{i,j}^t
$$

$$
u_{i,j}^{t+1} = 2u_{i,j}^t + \Delta t^2(u_{i+1,j}^{t+1} + u_{i-1,j}^{t+1} + u_{i,j+1}^{t+1} + u_{i,j-1}^{t+1} - 4u_{i,j}^{t+1}) - u_{i,j}^{t-1}
$$

$$
(1 + 4\Delta t^2)u_{i,j}^{t+1} = 2u_{i,j}^t + \Delta t^2(u_{i+1,j}^{t+1} + u_{i-1,j}^{t+1} + u_{i,j+1}^{t+1} + u_{i,j-1}^{t+1}) - u_{i,j}^{t-1}
$$

$$
u_{i,j}^{t+1} = \frac{2u_{i,j}^t + \Delta t^2(u_{i+1,j}^{t+1} + u_{i-1,j}^{t+1} + u_{i,j+1}^{t+1} + u_{i,j-1}^{t+1}) - u_{i,j}^{t-1}}{1 + 4\Delta t^2}
$$


In code,

    float result = ((bC * 2.0) - bP + (dtt * avg)) / (1.0 + 4.0 * dtt);

see sim.js, 548 line.


## How It Works: Damping

Hugo Elias method multiplies the damping per frame. 
If damping = 0.99, after 1 second (based on 60 fps), Ripple *= pow(0.99, 60) = 0.5471...

To represent based on dt, we can do pow(damping per second, dt) after iteration stage.

see sim.js, 601 line.



## 2D WebGL Demo

Hosted on github.io [here](https://jyarljung.github.io/Implicit_Ripple/)


## Source Material

- [Hugo Elias 2D Water](https://web.archive.org/web/20160505235423/http://freespace.virgin.net/hugo.elias/graphics/x_water.htm)
- Stam, J. 1999. "Stable Fluids."


## Credits
The WebGL rendering framework (including the FBO/SwapFBO double-buffering, shader program wrapper, and overall simulation loop) is adapted from **[inkbox](https://github.com/bassicali/inkbox)** by [bassicali](https://github.com/bassicali), licensed under the [MIT License](LICENSE).

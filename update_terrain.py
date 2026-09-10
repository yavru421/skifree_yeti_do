import re

def update_terrain():
    with open('src/client/terrain.ts', 'r', encoding='utf-8') as f:
        text = f.read()

    new_methods = '''
  public getTerrainHeightAt(px: number, pz: number): number {
    let y = 0;
    y += pz * Math.tan(this.getSlopePitchRad());
    const turnBank = Math.sin(pz * 0.008);
    y += px * turnBank * 0.15;
    y += Math.sin(pz * 0.015) * 4.0;
    y += Math.sin(px * 0.05 + pz * 0.02) * 2.5;
    y += Math.cos(px * 0.1 - pz * 0.04) * 1.5;
    return y;
  }

  private applyTerrainContours(chunk: import("@babylonjs/core").Mesh): void {
    const positions = chunk.getVerticesData("position");
    if (!positions) return;
    for (let i = 0; i < positions.length; i += 3) {
      const vx = positions[i];
      const vz = positions[i + 2];
      const worldZ = chunk.position.z + vz;
      positions[i + 1] = this.getTerrainHeightAt(vx, worldZ);
    }
    chunk.updateVerticesData("position", positions);
    chunk.computeNormals();
  }

  public applyTrack'''

    text = text.replace('  public applyTrack', new_methods)
    text = text.replace('this.groundChunks[i].position.y = 0;', 'this.groundChunks[i].position.y = 0;\n        this.applyTerrainContours(this.groundChunks[i]);')
    text = text.replace('chunk.position.z = newZ;\n        this.spawnObstaclesForChunk(newZ);', 'chunk.position.z = newZ;\n        this.applyTerrainContours(chunk);\n        this.spawnObstaclesForChunk(newZ);')

    text = text.replace('const postDist = Math.min(35, halfWidth * 0.75);', 'const postDist = Math.min(35, halfWidth * 0.75);\n    const yCenter = this.getTerrainHeightAt(0, z);')
    text = text.replace('postL.position.set(-postDist, 5.5, z);', 'postL.position.set(-postDist, this.getTerrainHeightAt(-postDist, z) + 5.5, z);')
    text = text.replace('postR.position.set(postDist, 5.5, z);', 'postR.position.set(postDist, this.getTerrainHeightAt(postDist, z) + 5.5, z);')
    text = text.replace('beam.position.set(0, 10.5, z);', 'beam.position.set(0, yCenter + 10.5, z);')
    text = text.replace('signPlane.position.set(0, 10.5, z + 0.48);', 'signPlane.position.set(0, yCenter + 10.5, z + 0.48);')

    text = text.replace('fenceL.position.set(-halfWidth, 1.2, fz);', 'fenceL.position.set(-halfWidth, this.getTerrainHeightAt(-halfWidth, fz) + 1.2, fz);')
    text = text.replace('fenceR.position.set(halfWidth, 1.2, fz);', 'fenceR.position.set(halfWidth, this.getTerrainHeightAt(halfWidth, fz) + 1.2, fz);')
    text = text.replace('mogul.position.set(mx, 0.4 * scale, mz);', 'mogul.position.set(mx, this.getTerrainHeightAt(mx, mz) + 0.4 * scale, mz);')

    text = text.replace('rock.position.set(x, 0.7, z);', 'rock.position.set(x, this.getTerrainHeightAt(x, z) + 0.7, z);')
    text = text.replace('aspen.position.set(x, 4.25, z);', 'aspen.position.set(x, this.getTerrainHeightAt(x, z) + 4.25, z);')
    text = text.replace('tree.position.set(x, 4.0, z);', 'tree.position.set(x, this.getTerrainHeightAt(x, z) + 4.0, z);')

    text = text.replace('leftPole.position.set(leftX, 2.2, z);', 'leftPole.position.set(leftX, this.getTerrainHeightAt(leftX, z) + 2.2, z);')
    text = text.replace('rightPole.position.set(rightX, 2.2, z);', 'rightPole.position.set(rightX, this.getTerrainHeightAt(rightX, z) + 2.2, z);')

    text = text.replace('powerMesh.position.set(x, 1.8, z);', 'powerMesh.position.set(x, this.getTerrainHeightAt(x, z) + 1.8, z);')

    text = text.replace('pup.mesh.position.y = 1.8 + Math.sin(performance.now() * 0.004) * 0.3;', 'pup.mesh.position.y = this.getTerrainHeightAt(pup.x, pup.z) + 1.8 + Math.sin(performance.now() * 0.004) * 0.3;')

    with open('src/client/terrain.ts', 'w', encoding='utf-8') as f:
        f.write(text)
    print('Done!')

if __name__ == "__main__":
    update_terrain()

import React from 'react';
import { useTypography } from '../contexts/TypographyContext';
import { StyledWordText } from './StyledWordText';

interface LogoProps {
  className?: string;
  size?: number | string;
  variant?: 'mark' | 'badge' | 'full';
}

export const LITTLE_BUDS_PALETTE = {
  sunGold: '#F5A623',
  sunGoldDark: '#D97706',
  sunGoldLight: '#FEF3C7',
  leafGreen: '#74B72E',
  leafGreenDark: '#558B2F',
  leafGreenLight: '#ECFCCB',
  skyBlue: '#42A5F5',
  skyBlueDark: '#0284C7',
  skyBlueLight: '#E0F2FE',
  tulipCoral: '#E53935',
  tulipCoralLight: '#FFE4E6',
  earthBrown: '#8D5B4C',
  earthBrownDark: '#6E4235',
  earthBrownLight: '#F5ECE8'
};

export const LittleBudsLogo: React.FC<LogoProps> = ({
  className = 'h-10 w-10',
  size,
  variant = 'mark'
}) => {
  const svgStyle = size ? { width: size, height: size } : undefined;

  const svgContent = (
    <svg
      viewBox="0 0 500 500"
      className={variant === 'mark' ? className : 'w-full h-full'}
      style={svgStyle}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Little Buds Child Care Centre Logo"
    >
      {/* Warm Golden Sun Arc (Framing halo) */}
      <path
        d="M 92 372 C 45 272 82 145 180 82 C 275 22 400 55 450 152 C 478 206 476 270 446 324 C 424 362 398 375 404 372 C 438 308 440 234 410 172 C 362 76 242 42 146 98 C 58 148 24 266 68 360 C 76 376 86 385 92 372 Z"
        fill="#F5A623"
      />

      {/* Earth / Ground Base */}
      <path
        d="M 65 455 C 135 422 230 405 315 410 C 375 414 415 432 435 455 C 385 432 320 420 250 420 C 180 420 115 432 65 455 Z"
        fill="#8D5B4C"
      />

      {/* Toddler Silhouette in Fresh Green */}
      <g fill="#74B72E">
        {/* Sitting Body & Legs */}
        <path d="M 120 380 C 105 390 102 412 118 425 C 135 432 170 428 190 420 C 210 415 235 418 240 408 C 242 400 232 392 215 390 C 200 388 185 395 168 396 C 182 385 192 370 192 350 C 190 330 172 320 155 328 C 145 333 138 345 136 358 C 128 362 122 370 120 380 Z" />
        
        {/* Reaching Baby Arm & Hand */}
        <path d="M 165 335 C 180 328 198 312 215 296 C 220 292 225 285 235 288 C 240 292 238 298 230 305 C 220 315 205 332 192 342 C 185 348 175 352 168 350 Z" />
        {/* Little outstretched fingers */}
        <path d="M 233 287 C 238 280 244 278 246 282 C 248 286 242 292 236 295 Z" />
        <path d="M 230 290 C 238 286 243 286 244 290 C 245 294 238 298 231 300 Z" />
        <path d="M 226 295 C 234 294 240 297 238 301 C 236 305 229 306 224 302 Z" />

        {/* Baby Head & Cute Curls */}
        <path d="M 152 250 C 130 250 112 268 112 290 C 112 295 106 292 102 288 C 98 284 94 288 96 294 C 98 300 106 304 112 302 C 114 314 124 326 138 332 C 146 335 155 334 162 330 C 172 328 182 322 185 312 C 187 305 182 300 178 298 C 184 296 188 290 186 284 C 183 278 178 276 172 277 C 174 265 168 252 152 250 Z" />
        <path d="M 152 250 C 156 242 164 238 168 242 C 172 246 165 254 158 256 Z" />
        <path d="M 148 252 C 150 244 155 242 158 246 C 160 250 156 254 152 255 Z" />
      </g>

      {/* Growing Plant Stem */}
      <path
        d="M 272 410 C 275 375 272 325 285 270 C 295 228 305 205 312 198 C 304 205 290 238 280 275 C 268 325 268 375 264 410 Z"
        fill="#558B2F"
      />

      {/* Left Leaf in Leaf Green with White Vein */}
      <g>
        <path
          d="M 284 256 C 270 230 240 185 185 172 C 190 205 208 245 252 260 C 265 265 278 262 284 256 Z"
          fill="#689F38"
        />
        <path
          d="M 276 254 C 255 240 230 215 200 184"
          stroke="#FFFFFF"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </g>

      {/* Right Leaf in Sky Blue with White Vein */}
      <g>
        <path
          d="M 292 298 C 315 285 375 258 418 220 C 395 262 355 305 304 310 C 296 310 290 305 292 298 Z"
          fill="#42A5F5"
        />
        <path
          d="M 302 304 C 335 292 375 268 406 232"
          stroke="#FFFFFF"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </g>

      {/* Tulip Flower Bud in Coral Red */}
      <g>
        {/* Back / Center Petal */}
        <path
          d="M 326 95 C 330 115 342 140 348 160 C 335 152 320 138 316 122 C 314 110 320 100 326 95 Z"
          fill="#E53935"
        />
        {/* Left Petal */}
        <path
          d="M 312 198 C 298 175 280 148 290 120 C 298 100 318 105 326 128 C 322 152 308 178 312 198 Z"
          fill="#EF4444"
        />
        {/* Right Petal */}
        <path
          d="M 312 198 C 322 178 348 152 352 125 C 354 110 340 106 332 120 C 328 145 318 175 312 198 Z"
          fill="#E53935"
        />
        {/* White petal divider */}
        <path
          d="M 326 128 C 322 152 314 175 312 198"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.9"
        />
      </g>
    </svg>
  );

  if (variant === 'badge') {
    return (
      <div className={`p-2 bg-white rounded-2xl shadow-sm border border-emerald-100/80 flex items-center justify-center ${className}`}>
        {svgContent}
      </div>
    );
  }

  return svgContent;
};

export const LittleBudsBrandHeader: React.FC<{
  collapsed?: boolean;
  subtitle?: boolean;
  size?: 'sm' | 'md' | 'lg';
}> = ({ collapsed = false, subtitle = true, size = 'md' }) => {
  const logoDimensions = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-14 w-14' : 'h-10 w-10';
  const typography = useTypography();

  return (
    <div className="flex items-center space-x-3">
      <div className="relative flex-shrink-0">
        <LittleBudsLogo className={logoDimensions} />
      </div>
      {!collapsed && (
        <div className="flex flex-col min-w-0">
          <div className="flex items-baseline space-x-1">
            {typography ? (
              <StyledWordText
                words={typography.brandTitleWords}
                fontSize={typography.elementFontSizes.brandTitle}
                className="font-extrabold tracking-tight leading-tight"
              />
            ) : (
              <span className="font-extrabold tracking-tight text-gray-900 text-lg leading-tight">
                Little<span className="text-[#558B2F]">Buds</span>
              </span>
            )}
          </div>
          {subtitle && (
            <div className="mt-0.5">
              {typography ? (
                <StyledWordText
                  words={typography.brandSubtitleWords}
                  fontSize={typography.elementFontSizes.brandSubtitle}
                  className="font-semibold uppercase tracking-wider truncate block"
                />
              ) : (
                <span className="text-[10px] font-semibold text-[#8D5B4C] tracking-wide uppercase truncate">
                  Child Care Centre
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
